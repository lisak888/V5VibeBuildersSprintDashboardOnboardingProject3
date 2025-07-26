import {
  users,
  sprints,
  sprintCommitments,
  webhookLogs,
  type User,
  type InsertUser,
  type Sprint,
  type InsertSprint,
  type SprintCommitment,
  type InsertSprintCommitment,
  type WebhookLog,
  type InsertWebhookLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, gte, lte, inArray } from "drizzle-orm";
import { randomUUID } from 'crypto';

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Sprint methods
  getUserSprints(userId: string): Promise<Sprint[]>;
  getSprintById(id: string): Promise<Sprint | undefined>;
  createSprint(sprint: InsertSprint): Promise<Sprint>;
  updateSprint(id: string, updates: Partial<InsertSprint>): Promise<Sprint>;
  getSprintsByStatus(userId: string, status: "historic" | "current" | "future"): Promise<Sprint[]>;
  getSprintsByNumbers(userId: string, sprintNumbers: number[]): Promise<Sprint[]>;

  // Sprint commitment methods
  getSprintCommitments(userId: string, sprintIds?: string[]): Promise<SprintCommitment[]>;
  createSprintCommitment(commitment: InsertSprintCommitment): Promise<SprintCommitment>;
  updateSprintCommitment(id: string, updates: Partial<InsertSprintCommitment>): Promise<SprintCommitment>;
  deleteSprintCommitment(id: string): Promise<void>;
  getCommitmentsBySprintId(sprintId: string): Promise<SprintCommitment[]>;
  getSprintsByIds(userId: string, sprintIds: string[]): Promise<Sprint[]>;

  // Webhook log methods
  createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog>;
  getWebhookLogs(userId: string): Promise<WebhookLog[]>;
}

// Transaction type for database operations
type TransactionDb = typeof db;
type TransactionFn<T> = (tx: TransactionDb) => Promise<T>;

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Sprint methods
  async getUserSprints(userId: string): Promise<Sprint[]> {
    return db
      .select()
      .from(sprints)
      .where(eq(sprints.userId, userId))
      .orderBy(asc(sprints.sprintNumber));
  }

  async getSprintById(id: string): Promise<Sprint | undefined> {
    const [sprint] = await db.select().from(sprints).where(eq(sprints.id, id));
    return sprint || undefined;
  }

  async createSprint(insertSprint: InsertSprint): Promise<Sprint> {
    const [sprint] = await db
      .insert(sprints)
      .values(insertSprint)
      .returning();
    return sprint;
  }

  async updateSprint(id: string, updates: Partial<InsertSprint>): Promise<Sprint> {
    const [sprint] = await db
      .update(sprints)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sprints.id, id))
      .returning();
    return sprint;
  }

  async getSprintsByStatus(userId: string, status: "historic" | "current" | "future"): Promise<Sprint[]> {
    return db
      .select()
      .from(sprints)
      .where(and(eq(sprints.userId, userId), eq(sprints.status, status)))
      .orderBy(asc(sprints.sprintNumber));
  }

  async getSprintsByNumbers(userId: string, sprintNumbers: number[]): Promise<Sprint[]> {
    if (sprintNumbers.length === 0) return [];

    return db
      .select()
      .from(sprints)
      .where(and(
        eq(sprints.userId, userId),
        inArray(sprints.sprintNumber, sprintNumbers)
      ))
      .orderBy(asc(sprints.sprintNumber));
  }

  async getSprintCommitments(userId: string, sprintIds?: string[]): Promise<SprintCommitment[]> {
    let query = db
      .select()
      .from(sprintCommitments)
      .where(eq(sprintCommitments.userId, userId));

    if (sprintIds && sprintIds.length > 0) {
      query = query.where(
        and(
          eq(sprintCommitments.userId, userId),
          inArray(sprintCommitments.sprintId, sprintIds)
        )
      );
    }

    return query.orderBy(desc(sprintCommitments.createdAt));
  }

  async getSprintsByIds(userId: string, sprintIds: string[]) {
    if (sprintIds.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(sprints)
      .where(
        and(
          eq(sprints.userId, userId),
          inArray(sprints.id, sprintIds)
        )
      );
  }

  async createSprintCommitment(commitment: InsertSprintCommitment): Promise<SprintCommitment> {
    const [created] = await db
      .insert(sprintCommitments)
      .values(commitment)
      .returning();
    return created;
  }

  async updateSprintCommitment(id: string, updates: Partial<InsertSprintCommitment>): Promise<SprintCommitment> {
    const [updated] = await db
      .update(sprintCommitments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sprintCommitments.id, id))
      .returning();
    return updated;
  }

  async deleteSprintCommitment(id: string): Promise<void> {
    await db.delete(sprintCommitments).where(eq(sprintCommitments.id, id));
  }

  async getCommitmentsBySprintId(sprintId: string): Promise<SprintCommitment[]> {
    return db
      .select()
      .from(sprintCommitments)
      .where(eq(sprintCommitments.sprintId, sprintId));
  }

  // Webhook log methods
  async createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog> {
    const [created] = await db
      .insert(webhookLogs)
      .values(log)
      .returning();
    return created;
  }

  async getWebhookLogs(userId: string): Promise<WebhookLog[]> {
    return db
      .select()
      .from(webhookLogs)
      .where(eq(webhookLogs.userId, userId))
      .orderBy(desc(webhookLogs.createdAt));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateSprintStatus(sprintId: string, status: "historic" | "current" | "future"): Promise<void> {
    await db
      .update(sprints)
      .set({ status })
      .where(eq(sprints.id, sprintId));
  }

  async deleteSprint(sprintId: string): Promise<void> {
    // First delete any related sprint commitments
    await db
      .delete(sprintCommitments)
      .where(eq(sprintCommitments.sprintId, sprintId));

    // Then delete the sprint
    await db
      .delete(sprints)
      .where(eq(sprints.id, sprintId));
  }

  async executeTransaction<T>(fn: TransactionFn<T>): Promise<T> {
    return await db.transaction(fn);
  }
}

export const storage = new DatabaseStorage();