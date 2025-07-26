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
        dashboard_url: this.generateDashboardUrl(username),
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
        dashboard_url: this.generateDashboardUrl(username),
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

  /**
   * Generate dynamic dashboard URL based on environment
   */
  private static generateDashboardUrl(username: string): string {
    // In production, use the deployed URL
    if (process.env.NODE_ENV === 'production') {
      // Check for custom domain or use Replit deployment URL
      const customDomain = process.env.CUSTOM_DOMAIN;
      if (customDomain) {
        return `https://${customDomain}/dashboard/${username}`;
      }

      // Replit deployment URLs follow pattern: https://{repl-id}.{username}.repl.co
      const replId = process.env.REPL_SLUG || 'vibe-builders-dashboard';
      const replOwner = process.env.REPL_OWNER || 'user';
      return `https://${replId}.${replOwner}.repl.co/dashboard/${username}`;
    }

    // In development, use local URL with proper binding
    const port = process.env.PORT || '5000';
    const host = process.env.NODE_ENV === 'development' ? 'localhost' : '0.0.0.0';
    return `http://${host}:${port}/dashboard/${username}`;
  }

  /**
   * Get the base application URL for webhook payloads
   */
  private static getBaseUrl(): string {
    if (process.env.NODE_ENV === 'production') {
      const customDomain = process.env.CUSTOM_DOMAIN;
      if (customDomain) {
        return `https://${customDomain}`;
      }

      const replId = process.env.REPL_SLUG || 'vibe-builders-dashboard';
      const replOwner = process.env.REPL_OWNER || 'user';
      return `https://${replId}.${replOwner}.repl.co`;
    }

    const port = process.env.PORT || '5000';
    const host = process.env.NODE_ENV === 'development' ? 'localhost' : '0.0.0.0';
    return `http://${host}:${port}`;
  }
}