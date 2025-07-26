
import { storage } from "../storage";

export interface PreviousCommitmentState {
  sprintId: string;
  type: "build" | "test" | "pto" | null;
  description: string | null;
}

export interface CommitmentChange {
  sprintId: string;
  previousState: {
    type: "build" | "test" | "pto" | null;
    description: string | null;
  };
  newState: {
    type: "build" | "test" | "pto" | null;
    description: string | null;
  };
  isNewCommitment: boolean;
  changeType: "none" | "new_commitment" | "type_change" | "description_change" | "removal";
}

export interface StateChangeResult {
  hasChanges: boolean;
  newCommitments: CommitmentChange[];
  allChanges: CommitmentChange[];
  webhookTriggers: Array<{
    sprintId: string;
    sprint: any;
    commitment: any;
  }>;
}

export class StateChangeDetector {
  /**
   * Task 7: Fetch previous state from database
   * Gets the current state of sprint commitments before processing new submissions
   */
  static async fetchPreviousState(userId: string, sprintIds: string[]): Promise<Map<string, PreviousCommitmentState>> {
    try {
      const previousStateMap = new Map<string, PreviousCommitmentState>();

      // Get current sprint data from database
      const sprints = await storage.getSprintsByIds(userId, sprintIds);
      
      for (const sprint of sprints) {
        previousStateMap.set(sprint.id, {
          sprintId: sprint.id,
          type: sprint.type,
          description: sprint.description,
        });
      }

      // For any sprints not found in database, set null state
      for (const sprintId of sprintIds) {
        if (!previousStateMap.has(sprintId)) {
          previousStateMap.set(sprintId, {
            sprintId,
            type: null,
            description: null,
          });
        }
      }

      return previousStateMap;
    } catch (error) {
      console.error("Error fetching previous state:", error);
      throw new Error("Failed to fetch previous commitment state");
    }
  }

  /**
   * Task 8: Create state comparison algorithms
   * Compares previous and new states to identify changes
   */
  static compareCommitmentStates(
    previousState: PreviousCommitmentState,
    newCommitment: { type: "build" | "test" | "pto" | null; description?: string }
  ): CommitmentChange {
    const newDescription = newCommitment.description || null;
    const previousType = previousState.type;
    const previousDescription = previousState.description;
    const newType = newCommitment.type;

    // Determine if this is a new commitment (null/empty to committed)
    const wasUncommitted = !previousType;
    const isNowCommitted = !!newType;
    const isNewCommitment = wasUncommitted && isNowCommitted;

    // Determine change type
    let changeType: CommitmentChange["changeType"] = "none";
    
    if (isNewCommitment) {
      changeType = "new_commitment";
    } else if (previousType && !newType) {
      changeType = "removal";
    } else if (previousType !== newType) {
      changeType = "type_change";
    } else if (previousDescription !== newDescription) {
      changeType = "description_change";
    }

    return {
      sprintId: previousState.sprintId,
      previousState: {
        type: previousType,
        description: previousDescription,
      },
      newState: {
        type: newType,
        description: newDescription,
      },
      isNewCommitment,
      changeType,
    };
  }

  /**
   * Task 9: Add new commitment identification logic
   * Identifies which commitments are truly new (null/empty to Build/Test/PTO transitions)
   */
  static identifyNewCommitments(changes: CommitmentChange[]): CommitmentChange[] {
    return changes.filter(change => {
      // New commitment is defined as:
      // 1. Previous state was null/empty (no commitment)
      // 2. New state has a commitment type (Build/Test/PTO)
      const hadNoCommitment = !change.previousState.type;
      const hasNewCommitment = !!change.newState.type;
      
      return hadNoCommitment && hasNewCommitment && change.isNewCommitment;
    });
  }

  /**
   * Task 10: Build change detection for each future sprint
   * Processes all future sprints individually to detect changes
   */
  static async detectChangesForFutureSprints(
    userId: string,
    commitmentUpdates: Array<{ sprintId: string; type: "build" | "test" | "pto" | null; description?: string }>
  ): Promise<StateChangeResult> {
    try {
      // Get sprint IDs
      const sprintIds = commitmentUpdates.map(update => update.sprintId);
      
      // Fetch previous state
      const previousStateMap = await this.fetchPreviousState(userId, sprintIds);
      
      // Compare each sprint individually
      const allChanges: CommitmentChange[] = [];
      
      for (const update of commitmentUpdates) {
        const previousState = previousStateMap.get(update.sprintId);
        if (!previousState) {
          console.warn(`No previous state found for sprint ${update.sprintId}`);
          continue;
        }
        
        const change = this.compareCommitmentStates(previousState, update);
        allChanges.push(change);
      }
      
      // Identify new commitments
      const newCommitments = this.identifyNewCommitments(allChanges);
      
      // Check if there are any changes
      const hasChanges = allChanges.some(change => change.changeType !== "none");
      
      // Prepare webhook triggers for new commitments
      const webhookTriggers = await this.prepareWebhookTriggers(userId, newCommitments);
      
      return {
        hasChanges,
        newCommitments,
        allChanges,
        webhookTriggers,
      };
    } catch (error) {
      console.error("Error detecting changes for future sprints:", error);
      throw new Error("Failed to detect sprint commitment changes");
    }
  }

  /**
   * Task 11: Create webhook trigger preparation system
   * Prepares webhook data for new commitments that need external notifications
   */
  static async prepareWebhookTriggers(
    userId: string,
    newCommitments: CommitmentChange[]
  ): Promise<Array<{ sprintId: string; sprint: any; commitment: any }>> {
    try {
      const webhookTriggers: Array<{ sprintId: string; sprint: any; commitment: any }> = [];
      
      for (const change of newCommitments) {
        if (!change.isNewCommitment || !change.newState.type) {
          continue;
        }
        
        // Get sprint details for webhook payload
        const sprint = await storage.getSprintById(change.sprintId);
        if (!sprint) {
          console.warn(`Sprint ${change.sprintId} not found for webhook preparation`);
          continue;
        }
        
        // Create commitment record for tracking
        const commitment = {
          userId,
          sprintId: change.sprintId,
          type: change.newState.type,
          description: change.newState.description,
          isNewCommitment: true,
          timestamp: new Date().toISOString(),
        };
        
        webhookTriggers.push({
          sprintId: change.sprintId,
          sprint,
          commitment,
        });
      }
      
      return webhookTriggers;
    } catch (error) {
      console.error("Error preparing webhook triggers:", error);
      throw new Error("Failed to prepare webhook triggers");
    }
  }

  /**
   * Helper method to get detailed change summary
   */
  static getChangeSummary(result: StateChangeResult): {
    totalChanges: number;
    newCommitments: number;
    typeChanges: number;
    descriptionChanges: number;
    removals: number;
  } {
    return {
      totalChanges: result.allChanges.filter(c => c.changeType !== "none").length,
      newCommitments: result.newCommitments.length,
      typeChanges: result.allChanges.filter(c => c.changeType === "type_change").length,
      descriptionChanges: result.allChanges.filter(c => c.changeType === "description_change").length,
      removals: result.allChanges.filter(c => c.changeType === "removal").length,
    };
  }
}
