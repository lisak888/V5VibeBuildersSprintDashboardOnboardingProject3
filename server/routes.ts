import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { SprintCalculator } from "./services/sprintCalculator";
import { WebhookService } from "./services/webhookService";
import { StateChangeDetector } from "./services/stateChangeDetector";
import { updateSprintCommitmentsSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {

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

      // Get all sprints with updated data
      const allSprints = await storage.getUserSprints(user.id);

      // Get sprint commitments
      const sprintCommitments = await storage.getSprintCommitments(user.id);

      // Organize data
      const historicSprints = allSprints.filter(s => s.status === "historic");
      const currentSprint = allSprints.find(s => s.status === "current");
      const futureSprints = allSprints.filter(s => s.status === "future");

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

      // Prepare webhook records for response
      const newCommitmentRecords: Array<{ sprint: any; commitment: any }> = changeResult.webhookTriggers.map(trigger => ({
        sprint: trigger.sprint,
        commitment: {
          userId: user.id,
          sprintId: trigger.sprintId,
          type: trigger.commitment.type,
          description: trigger.commitment.description || null,
          isNewCommitment: true,
        }
      }));

      // Send webhooks for new commitments sequentially
      if (newCommitmentRecords.length > 0) {
        const webhookResults = await WebhookService.sendNewCommitmentWebhooks(
          user.id,
          user.username,
          newCommitmentRecords
        );

        console.log(`Sent ${webhookResults.sent} webhooks, ${webhookResults.failed} failed`);
      }

      // Get updated data
      const allSprints = await storage.getUserSprints(user.id);
      const futureSprints = allSprints.filter(s => s.status === "future");
      const futureCommittedSprints = futureSprints.filter(s => s.type);

      const buildCount = futureCommittedSprints.filter(s => s.type === "build").length;
      const ptoCount = futureCommittedSprints.filter(s => s.type === "pto").length;
      const isValid = buildCount >= 2 && ptoCount <= 2;

      const changeSummary = StateChangeDetector.getChangeSummary(changeResult);

      res.json({
        success: true,
        newCommitments: changeSummary.newCommitments,
        webhooksSent: newCommitmentRecords.length,
        changes: {
          hasChanges: changeResult.hasChanges,
          totalChanges: changeSummary.totalChanges,
          newCommitments: changeSummary.newCommitments,
          typeChanges: changeSummary.typeChanges,
          descriptionChanges: changeSummary.descriptionChanges,
          removals: changeSummary.removals,
        },
        validation: {
          isValid,
          buildCount,
          ptoCount,
          errors: isValid ? [] : [
            buildCount < 2 ? "Minimum 2 Build sprints required in 6-sprint window" : null,
            ptoCount > 2 ? "Maximum 2 PTO sprints allowed in 6-sprint window" : null,
          ].filter(Boolean),
        },
      });
    } catch (error) {
      console.error("Error updating commitments:", error);
      res.status(500).json({ message: "Failed to update commitments" });
    }
  });

  // Sprint transition API endpoint (called by Make.com)
  app.post("/api/advance-sprint", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const expectedToken = process.env.SPRINT_TRANSITION_TOKEN || "default-token";

      if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get current sprint calculations
      const sprintNumbers = SprintCalculator.getAllRelevantSprintNumbers();
      const currentSprintNumber = SprintCalculator.getCurrentSprintNumber();

      console.log(`Starting sprint transition to sprint ${currentSprintNumber}`);
      
      // Get all users to process their sprints
      const allUsers = await storage.getAllUsers();
      let totalSprintsProcessed = 0;
      let usersProcessed = 0;

      for (const user of allUsers) {
        try {
          // Get user's existing sprints
          const userSprints = await storage.getUserSprints(user.id);
          
          // Prepare transaction operations
          const statusUpdates: Array<{ sprintId: string; status: "historic" | "current" | "future" }> = [];
          const newSprints: Array<{
            sprintNumber: number;
            startDate: Date;
            endDate: Date;
            type: "build" | "test" | "pto" | null;
            description: string | null;
            status: "historic" | "current" | "future";
          }> = [];
          const sprintsToDelete: string[] = [];

          // Collect sprint status updates
          for (const sprint of userSprints) {
            const sprintInfo = SprintCalculator.getSprintInfo(sprint.sprintNumber);
            
            if (sprint.status !== sprintInfo.status) {
              statusUpdates.push({
                sprintId: sprint.id,
                status: sprintInfo.status
              });
            }
          }

          // Collect new sprints to create
          const existingSprintNumbers = new Set(userSprints.map(s => s.sprintNumber));
          const allRequiredSprints = [
            ...sprintNumbers.historic,
            sprintNumbers.current,
            ...sprintNumbers.future
          ];

          const missingSprintNumbers = allRequiredSprints.filter(num => !existingSprintNumbers.has(num));
          
          for (const sprintNumber of missingSprintNumbers) {
            const sprintInfo = SprintCalculator.getSprintInfo(sprintNumber);
            newSprints.push({
              sprintNumber,
              startDate: sprintInfo.startDate,
              endDate: sprintInfo.endDate,
              type: null, // New future sprints start uncommitted
              description: null,
              status: sprintInfo.status,
            });
          }

          // Collect old historic sprints to remove
          const historicSprints = userSprints
            .filter(s => s.status === 'historic')
            .sort((a, b) => a.sprintNumber - b.sprintNumber);
          
          if (historicSprints.length > 24) {
            const sprintsToRemove = historicSprints.slice(0, historicSprints.length - 24);
            sprintsToDelete.push(...sprintsToRemove.map(s => s.id));
          }

          // Execute all operations in a single transaction
          if (statusUpdates.length > 0 || newSprints.length > 0 || sprintsToDelete.length > 0) {
            await storage.executeSprintTransition(user.id, {
              statusUpdates,
              newSprints,
              sprintsToDelete
            });
            
            totalSprintsProcessed += statusUpdates.length + newSprints.length + sprintsToDelete.length;
          }

          usersProcessed++;
        } catch (userError) {
          console.error(`Error processing user ${user.username}:`, userError);
          // Continue processing other users even if one fails
        }
      }

      console.log(`Sprint transition completed: ${usersProcessed} users processed, ${totalSprintsProcessed} sprint updates made`);

      res.json({
        success: true,
        message: "Sprint transition completed",
        currentSprint: currentSprintNumber,
        usersProcessed,
        sprintUpdates: totalSprintsProcessed,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error advancing sprint:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to advance sprint",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

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