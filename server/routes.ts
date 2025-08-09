import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { SprintCalculator } from "./services/sprintCalculator";
import { WebhookService } from "./services/webhookService";
import { StateChangeDetector } from "./services/stateChangeDetector";
import { updateSprintCommitmentsSchema } from "@shared/schema";
import { z } from "zod";
import completionRouter from "./routes/completion";
import { sendWebhook } from "./utils/webhookService";

export async function registerRoutes(app: Express): Promise<Server> {

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString()
    });
  });

  // Mount the dashboard completion webhook router
  app.use('/api/dashboard-complete', completionRouter);

  // Get dashboard data for a user
  app.get("/api/dashboard/:username", async (req, res) => {
    try {
      const { username } = req.params;

      // Get or create user
      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.createUser({ username, password: "default" });
      }

      // Get all relevant sprint numbers
      const sprintNumbers = SprintCalculator.getAllRelevantSprintNumbers();
      const allSprintNumbers = [
        ...sprintNumbers.historic,
        sprintNumbers.current,
        ...sprintNumbers.future,
      ];

      // Get existing sprints from database
      const existingSprints = await storage.getSprintsByNumbers(user.id, allSprintNumbers);
      const existingSprintNumbers = new Set(existingSprints.map(s => s.sprintNumber));

      // Create missing sprints
      const missingSprintNumbers = allSprintNumbers.filter(num => !existingSprintNumbers.has(num));

      for (const sprintNumber of missingSprintNumbers) {
        const sprintInfo = SprintCalculator.getSprintInfo(sprintNumber);

        // Set initial state for sprints
        let type: "build" | "test" | "pto" | null = null;
        let description: string | null = null;

        // Set initial data for first historic and current sprint
        if (sprintNumber === sprintNumbers.historic[sprintNumbers.historic.length - 1] || 
            sprintNumber === sprintNumbers.current) {
          type = "build";
          description = "Setting up the Vibe Builders individual member dashboard as part of Onboarding Project 3";
        }

        await storage.createSprint({
          userId: user.id,
          sprintNumber,
          startDate: sprintInfo.startDate,
          endDate: sprintInfo.endDate,
          type,
          description,
          status: sprintInfo.status,
        });
      }

      // Get all data efficiently using optimized queries
      const dashboardData = await storage.getDashboardData(user.id);
      const { sprints: allSprints, commitments: sprintCommitments } = dashboardData;

      // Organize data using efficient filtering
      const historicSprints = await storage.getSprintsByStatus(user.id, "historic");
      const currentSprint = await storage.getSprintsByStatus(user.id, "current").then(sprints => sprints[0]);
      const futureSprints = await storage.getSprintsByStatus(user.id, "future");

      // Self-healing: Verify sprint cycles are current and advance if needed
      console.log(`[SELF-HEALING] Verifying sprint cycles for user ${user.username}`);
      const healingResult = await advanceSprints(user.id);
      
      if (healingResult.transitionNeeded) {
        console.log(`[SELF-HEALING] Sprint transition performed for user ${user.username}: ${healingResult.sprintsUpdated} sprints updated`);
        
        // Re-fetch data after potential sprint advancement
        const updatedHistoricSprints = await storage.getSprintsByStatus(user.id, "historic");
        const updatedCurrentSprint = await storage.getSprintsByStatus(user.id, "current").then(sprints => sprints[0]);
        const updatedFutureSprints = await storage.getSprintsByStatus(user.id, "future");
        
        // Update our working data with the corrected sprint information
        historicSprints.splice(0, historicSprints.length, ...updatedHistoricSprints);
        Object.assign(currentSprint, updatedCurrentSprint);
        futureSprints.splice(0, futureSprints.length, ...updatedFutureSprints);
      } else {
        console.log(`[SELF-HEALING] Sprint cycles already current for user ${user.username}`);
      }

      // Calculate stats for validation
      const futureCommittedSprints = futureSprints.filter(s => s.type);
      const buildCount = futureCommittedSprints.filter(s => s.type === "build").length;
      const testCount = futureCommittedSprints.filter(s => s.type === "test").length;
      const ptoCount = futureCommittedSprints.filter(s => s.type === "pto").length;
      const uncommittedCount = futureSprints.filter(s => !s.type).length;

      const isValid = buildCount >= 2 && ptoCount <= 2;
      const daysRemaining = SprintCalculator.getDaysRemainingInCurrentSprint();

      res.json({
        user: { id: user.id, username: user.username },
        sprints: {
          historic: historicSprints,
          current: currentSprint,
          future: futureSprints,
        },
        stats: {
          buildCount,
          testCount,
          ptoCount,
          uncommittedCount,
          isValid,
          daysRemaining,
        },
        commitments: sprintCommitments,
      });
    } catch (error) {
      console.error("Error getting dashboard data:", error);
      res.status(500).json({ message: "Failed to get dashboard data" });
    }
  });

  // Update sprint commitments
  app.post("/api/dashboard/:username/commitments", async (req, res) => {
    try {
      const { username } = req.params;
      const validatedData = updateSprintCommitmentsSchema.parse(req.body);

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Use StateChangeDetector to analyze changes
      const changeResult = await StateChangeDetector.detectChangesForFutureSprints(
        user.id,
        validatedData.commitments
      );

      // Prepare transaction data
      const commitmentUpdates = validatedData.commitments.map(c => ({
        sprintId: c.sprintId,
        type: c.type || null,
        description: c.description || null,
      }));

      const newCommitmentData = changeResult.webhookTriggers.map(trigger => ({
        sprintId: trigger.sprintId,
        type: trigger.commitment.type,
        description: trigger.commitment.description || null,
      }));

      // Execute all commitment updates in a single transaction
      await storage.executeCommitmentUpdate(user.id, commitmentUpdates, newCommitmentData);

      // Send sequential webhooks for new commitments
      if (changeResult.newCommitments.length > 0) {
        const sprintReminderHookUrl = process.env.SPRINT_REMINDER_HOOK_URL;

        if (sprintReminderHookUrl) {
          for (const webhookTrigger of changeResult.webhookTriggers) {
            try {
              // Construct the webhook payload
              const payload = {
                user_name: username,
                sprint_start_date: webhookTrigger.sprint.startDate.toISOString().split('T')[0], // YYYY-MM-DD format
                sprint_type: webhookTrigger.commitment.type.charAt(0).toUpperCase() + webhookTrigger.commitment.type.slice(1), // Capitalize first letter
                ...(webhookTrigger.commitment.description && { description: webhookTrigger.commitment.description }),
                dashboard_url: `${process.env.REPL_URL || 'http://localhost:5000'}/dashboard/${username}`,
                timestamp: new Date().toISOString()
              };

              // Send webhook for this specific commitment
              const success = await sendWebhook(sprintReminderHookUrl, payload);

              if (success) {
                console.log(`New commitment webhook sent successfully for sprint ${webhookTrigger.sprint.sprintNumber}`);
              } else {
                console.error(`Failed to send new commitment webhook for sprint ${webhookTrigger.sprint.sprintNumber}`);
              }
            } catch (webhookError) {
              console.error(`Error sending webhook for sprint ${webhookTrigger.sprint.sprintNumber}:`, webhookError);
            }
          }
        } else {
          console.warn('SPRINT_REMINDER_HOOK_URL environment variable not set, skipping webhook notifications');
        }
      }

      res.json({ message: "Commitments updated successfully" });
    } catch (error) {
      console.error("Error updating commitments:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update commitments" });
    }
  });

  // Sprint transition API endpoint (called by Make.com)
  app.post("/api/advance-sprint", async (req, res) => {
    try {
      // Enhanced security check for Make.com authentication
      const authHeader = req.headers.authorization;
      const expectedToken = process.env.ADVANCE_SPRINT_SECRET || process.env.SPRINT_TRANSITION_TOKEN || "default-token";

      if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader !== `Bearer ${expectedToken}`) {
        console.warn(`[SECURITY] Unauthorized sprint advancement attempt from IP: ${req.ip}`);
        return res.status(401).json({ 
          success: false,
          message: "Unauthorized - Invalid or missing authentication token" 
        });
      }

      console.log(`[SPRINT-TRANSITION] Starting global sprint advancement process`);

      // Get all users to process their sprints
      const allUsers = await storage.getAllUsers();
      let totalUsersProcessed = 0;
      let totalSprintsUpdated = 0;
      let failedUsers: Array<{ username: string; error: string }> = [];

      // Process each user individually with proper error isolation
      for (const user of allUsers) {
        try {
          const userResult = await advanceSprints(user.id);
          
          if (userResult.success) {
            totalUsersProcessed++;
            totalSprintsUpdated += userResult.sprintsUpdated;
            console.log(`[SPRINT-TRANSITION] Successfully processed user ${user.username}: ${userResult.sprintsUpdated} sprints updated`);
          } else {
            failedUsers.push({
              username: user.username,
              error: userResult.error || "Unknown error during sprint advancement"
            });
            console.error(`[SPRINT-TRANSITION] Failed to process user ${user.username}: ${userResult.error}`);
          }
        } catch (userError) {
          const errorMessage = userError instanceof Error ? userError.message : "Unexpected error";
          failedUsers.push({
            username: user.username,
            error: errorMessage
          });
          console.error(`[SPRINT-TRANSITION] Exception processing user ${user.username}:`, userError);
        }
      }

      const currentSprintNumber = SprintCalculator.getCurrentSprintNumber();
      
      console.log(`[SPRINT-TRANSITION] Global sprint advancement completed: ${totalUsersProcessed}/${allUsers.length} users processed successfully`);

      if (failedUsers.length > 0) {
        console.warn(`[SPRINT-TRANSITION] ${failedUsers.length} users had errors:`, failedUsers);
      }

      res.json({
        success: true,
        message: "Sprint transition completed",
        currentSprint: currentSprintNumber,
        totalUsers: allUsers.length,
        usersProcessed: totalUsersProcessed,
        sprintsUpdated: totalSprintsUpdated,
        failedUsers,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[SPRINT-TRANSITION] Critical error during sprint advancement:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to advance sprint",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Advance sprints for a single user - idempotent sprint transition logic
   * This function handles the complete sprint transition lifecycle for one user
   */
  async function advanceSprints(userId: string): Promise<{
    success: boolean;
    sprintsUpdated: number;
    transitionNeeded: boolean;
    error?: string;
  }> {
    try {
      // Get current sprint calculations based on actual current date
      const currentSprintNumber = SprintCalculator.getCurrentSprintNumber();
      const sprintNumbers = SprintCalculator.getAllRelevantSprintNumbers();
      
      // Fetch all current sprint documents for the user
      const userSprints = await storage.getUserSprints(userId);
      
      // Find the sprint currently marked as 'current' in the database
      const currentSprintInDb = userSprints.find(sprint => sprint.status === 'current');
      
      // Determine if transition is needed by comparing sprint numbers
      let transitionNeeded = false;
      if (!currentSprintInDb) {
        // No current sprint exists - transition needed
        transitionNeeded = true;
        console.log(`[SPRINT-TRANSITION] User ${userId}: No current sprint found - transition needed`);
      } else if (currentSprintInDb.sprintNumber < currentSprintNumber) {
        // Database is behind the calculated current sprint - transition needed
        transitionNeeded = true;
        console.log(`[SPRINT-TRANSITION] User ${userId}: Database sprint ${currentSprintInDb.sprintNumber} behind calculated sprint ${currentSprintNumber} - transition needed`);
      } else if (currentSprintInDb.sprintNumber === currentSprintNumber) {
        // Already up to date - check if we need to create missing sprints
        const existingSprintNumbers = new Set(userSprints.map(s => s.sprintNumber));
        const allRequiredSprints = [
          ...sprintNumbers.historic,
          sprintNumbers.current,
          ...sprintNumbers.future
        ];
        const missingSprintNumbers = allRequiredSprints.filter(num => !existingSprintNumbers.has(num));
        
        if (missingSprintNumbers.length > 0) {
          transitionNeeded = true;
          console.log(`[SPRINT-TRANSITION] User ${userId}: Missing ${missingSprintNumbers.length} sprint records - creating them`);
        } else {
          console.log(`[SPRINT-TRANSITION] User ${userId}: Already up to date, no transition needed`);
          return { success: true, sprintsUpdated: 0, transitionNeeded: false };
        }
      } else {
        // Database is ahead of calculated current sprint - should not happen in normal operation
        console.warn(`[SPRINT-TRANSITION] User ${userId}: Database sprint ${currentSprintInDb.sprintNumber} ahead of calculated sprint ${currentSprintNumber} - no action taken`);
        return { success: true, sprintsUpdated: 0, transitionNeeded: false };
      }

      // If we reach here, a transition is needed
      if (transitionNeeded) {
        console.log(`[SPRINT-TRANSITION] User ${userId}: Executing sprint transition`);

        // Prepare operations for atomic transaction
        const operations = {
          statusUpdates: [] as Array<{ sprintId: string; status: "historic" | "current" | "future" }>,
          newSprints: [] as Array<{
            sprintNumber: number;
            startDate: Date;
            endDate: Date;
            type: "build" | "test" | "pto" | null;
            description: string | null;
            status: "historic" | "current" | "future";
          }>,
          sprintsToDelete: [] as string[]
        };

        // Build sprint status map for required updates
        const existingSprintMap = new Map(userSprints.map(sprint => [sprint.sprintNumber, sprint]));
        
        // Collect status updates for existing sprints
        const allRequiredSprints = [
          ...sprintNumbers.historic,
          sprintNumbers.current,
          ...sprintNumbers.future
        ];

        for (const sprintNumber of allRequiredSprints) {
          const existingSprint = existingSprintMap.get(sprintNumber);
          const expectedStatus = SprintCalculator.getSprintStatus(sprintNumber);

          if (existingSprint && existingSprint.status !== expectedStatus) {
            operations.statusUpdates.push({
              sprintId: existingSprint.id,
              status: expectedStatus
            });
          }
        }

        // Collect new sprints to create
        const existingSprintNumbers = new Set(userSprints.map(s => s.sprintNumber));
        const missingSprintNumbers = allRequiredSprints.filter(num => !existingSprintNumbers.has(num));

        for (const sprintNumber of missingSprintNumbers) {
          const sprintInfo = SprintCalculator.getSprintInfo(sprintNumber);
          operations.newSprints.push({
            sprintNumber,
            startDate: sprintInfo.startDate,
            endDate: sprintInfo.endDate,
            type: null, // New sprints start uncommitted
            description: null,
            status: sprintInfo.status,
          });
        }

        // Collect old historic sprints to remove (maintain max 24 historic)
        const historicSprints = userSprints
          .filter(s => s.status === 'historic' || SprintCalculator.getSprintStatus(s.sprintNumber) === 'historic')
          .sort((a, b) => a.sprintNumber - b.sprintNumber);

        if (historicSprints.length > 24) {
          const sprintsToRemove = historicSprints.slice(0, historicSprints.length - 24);
          operations.sprintsToDelete.push(...sprintsToRemove.map(s => s.id));
        }

        // Execute all operations in a single atomic transaction
        await storage.executeSprintTransition(userId, operations);

        const totalUpdates = operations.statusUpdates.length + operations.newSprints.length + operations.sprintsToDelete.length;
        
        console.log(`[SPRINT-TRANSITION] User ${userId}: Transition completed - ${operations.statusUpdates.length} updates, ${operations.newSprints.length} new sprints, ${operations.sprintsToDelete.length} deletions`);

        return { 
          success: true, 
          sprintsUpdated: totalUpdates, 
          transitionNeeded: true 
        };
      }

      return { success: true, sprintsUpdated: 0, transitionNeeded: false };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[SPRINT-TRANSITION] Error advancing sprints for user ${userId}:`, error);
      
      return { 
        success: false, 
        sprintsUpdated: 0, 
        transitionNeeded: false, 
        error: errorMessage 
      };
    }
  }

  // Send dashboard completion webhook
  app.post("/api/dashboard/:username/complete", async (req, res) => {
    try {
      const { username } = req.params;

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await WebhookService.sendDashboardCompletionWebhook(user.id, user.username);

      res.json({ success: true, message: "Dashboard completion webhook sent" });
    } catch (error) {
      console.error("Error sending completion webhook:", error);
      res.status(500).json({ message: "Failed to send completion webhook" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}