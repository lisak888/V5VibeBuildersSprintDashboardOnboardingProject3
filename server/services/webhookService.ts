import { type SprintCommitment, type Sprint } from "@shared/schema";
import { storage } from "../storage";

export interface NewCommitmentWebhookPayload {
  user_name: string;
  sprint_start_date: string;
  sprint_type: "Build" | "Test" | "PTO";
  description?: string;
  dashboard_url: string;
  timestamp: string;
}

export interface DashboardCompletionWebhookPayload {
  user_name: string;
  dashboard_url: string;
  completion_timestamp: string;
}

export class WebhookService {
  private static readonly WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || "https://hook.make.com/your-webhook-url";

  /**
   * Send webhook for new sprint commitment
   */
  static async sendNewCommitmentWebhook(
    userId: string,
    username: string,
    sprint: Sprint,
    commitment: SprintCommitment
  ): Promise<boolean> {
    try {
      const payload: NewCommitmentWebhookPayload = {
        user_name: username,
        sprint_start_date: sprint.startDate.toISOString().split('T')[0],
        sprint_type: this.capitalizeSprintType(commitment.type),
        description: commitment.description || undefined,
        dashboard_url: this.getDashboardUrl(),
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(this.WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const success = response.ok;

      // Log webhook attempt
      await storage.createWebhookLog({
        userId,
        sprintId: sprint.id,
        webhookType: "new_commitment",
        payload: JSON.stringify(payload),
        status: success ? "success" : "failed",
      });

      return success;
    } catch (error) {
      console.error("Failed to send new commitment webhook:", error);
      
      // Log failed webhook attempt
      await storage.createWebhookLog({
        userId,
        sprintId: sprint.id,
        webhookType: "new_commitment",
        payload: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
        status: "failed",
      });

      return false;
    }
  }

  /**
   * Send webhook for dashboard completion
   */
  static async sendDashboardCompletionWebhook(
    userId: string,
    username: string
  ): Promise<boolean> {
    try {
      const payload: DashboardCompletionWebhookPayload = {
        user_name: username,
        dashboard_url: this.getDashboardUrl(),
        completion_timestamp: new Date().toISOString(),
      };

      const response = await fetch(this.WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const success = response.ok;

      // Log webhook attempt
      await storage.createWebhookLog({
        userId,
        webhookType: "dashboard_completion",
        payload: JSON.stringify(payload),
        status: success ? "success" : "failed",
      });

      return success;
    } catch (error) {
      console.error("Failed to send dashboard completion webhook:", error);
      
      // Log failed webhook attempt
      await storage.createWebhookLog({
        userId,
        webhookType: "dashboard_completion",
        payload: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
        status: "failed",
      });

      return false;
    }
  }

  /**
   * Send multiple webhooks sequentially for new commitments
   */
  static async sendNewCommitmentWebhooks(
    userId: string,
    username: string,
    newCommitments: Array<{ sprint: Sprint; commitment: SprintCommitment }>
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const { sprint, commitment } of newCommitments) {
      const success = await this.sendNewCommitmentWebhook(userId, username, sprint, commitment);
      if (success) {
        sent++;
      } else {
        failed++;
      }
      
      // Small delay between webhook calls to avoid overwhelming the service
      if (newCommitments.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return { sent, failed };
  }

  private static capitalizeSprintType(type: "build" | "test" | "pto"): "Build" | "Test" | "PTO" {
    switch (type) {
      case "build":
        return "Build";
      case "test":
        return "Test";
      case "pto":
        return "PTO";
      default:
        return "Build";
    }
  }

  private static getDashboardUrl(): string {
    const replitDomains = process.env.REPLIT_DOMAINS;
    if (replitDomains) {
      const domains = replitDomains.split(',');
      return `https://${domains[0]}`;
    }
    return process.env.DASHBOARD_URL || "http://localhost:5000";
  }
}
