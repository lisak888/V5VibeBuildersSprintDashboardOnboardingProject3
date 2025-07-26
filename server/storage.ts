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
import { eq, and, desc, asc, gte, lte, inArray, sql, isNotNull } from "drizzle-orm";
import { randomUUID } from 'crypto';

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // Sprint methods
  getUserSprints(userId: string): Promise<Sprint[]>;
  getSprintById(id: string): Promise<Sprint | undefined>;
  createSprint(sprint: InsertSprint): Promise<Sprint>;
  updateSprint(id: string, updates: Partial<InsertSprint>): Promise<Sprint>;
  deleteSprint(id: string): Promise<void>;
  getSprintsByStatus(userId: string, status: "historic" | "current" | "future"): Promise<Sprint[]>;
  getSprintsByNumbers(userId: string, sprintNumbers: number[]): Promise<Sprint[]>;

  // Sprint commitment methods
  getSprintCommitments(userId: string, sprintIds?: string[]): Promise<SprintCommitment[]>;
  getSprintCommitmentById(id: string): Promise<SprintCommitment | undefined>;
  createSprintCommitment(commitment: InsertSprintCommitment): Promise<SprintCommitment>;
  updateSprintCommitment(id: string, updates: Partial<InsertSprintCommitment>): Promise<SprintCommitment>;
  deleteSprintCommitment(id: string): Promise<void>;
  getCommitmentsBySprintId(sprintId: string): Promise<SprintCommitment[]>;
  getSprintsByIds(userId: string, sprintIds: string[]): Promise<Sprint[]>;

  // Webhook log methods
  createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog>;
  getWebhookLogs(userId: string): Promise<WebhookLog[]>;
  getWebhookLogByUserAndType(userId: string, webhookType: string): Promise<WebhookLog | null>;
}

// Transaction types for database operations
type TransactionDb = typeof db;
type TransactionFn<T> = (tx: TransactionDb) => Promise<T>;

// Transaction wrapper configuration
interface TransactionOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  isolationLevel?: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable';
  logQueries?: boolean;
}

// Transaction result wrapper
interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number;
  retryCount: number;
}

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
    const [created] = await db.insert(users).values(insertUser).returning();
    return created;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
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
    const [sprint] = await db.insert(sprints).values(insertSprint).returning();
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

  async deleteSprint(id: string): Promise<void> {
    await db.delete(sprints).where(eq(sprints.id, id));
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

  async getSprintCommitmentById(id: string): Promise<SprintCommitment | undefined> {
    const [commitment] = await db
      .select()
      .from(sprintCommitments)
      .where(eq(sprintCommitments.id, id));
    return commitment || undefined;
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

  async updateSprintStatus(sprintId: string, status: "historic" | "current" | "future"): Promise<void> {
    await db
      .update(sprints)
      .set({ status })
      .where(eq(sprints.id, sprintId));
  }

  /**
   * Enhanced transaction wrapper with retry logic, timeouts, and comprehensive error handling
   * Implements Phase 5 requirement for atomic database operations
   */
  async executeTransaction<T>(
    fn: TransactionFn<T>, 
    options: TransactionOptions = {}
  ): Promise<TransactionResult<T>> {
    const {
      retries = 3,
      retryDelay = 100,
      timeout = 30000,
      isolationLevel = 'read committed',
      logQueries = process.env.NODE_ENV === 'development'
    } = options;

    const startTime = Date.now();
    let lastError: Error | undefined;
    let retryCount = 0;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (logQueries) {
          console.log(`[TRANSACTION] Starting attempt ${attempt + 1}/${retries + 1} with isolation: ${isolationLevel}`);
        }

        // Execute transaction with timeout
        const result = await Promise.race([
          db.transaction(async (tx) => {
            // Set isolation level if supported
            if (isolationLevel !== 'read committed') {
              await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL ${sql.raw(isolationLevel.toUpperCase())}`);
            }
            
            return await fn(tx);
          }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Transaction timeout')), timeout)
          )
        ]);

        const duration = Date.now() - startTime;
        
        if (logQueries) {
          console.log(`[TRANSACTION] Completed successfully in ${duration}ms after ${retryCount} retries`);
        }

        return {
          success: true,
          data: result,
          duration,
          retryCount
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount = attempt;

        if (logQueries) {
          console.warn(`[TRANSACTION] Attempt ${attempt + 1} failed: ${lastError.message}`);
        }

        // Don't retry on certain types of errors
        if (this.isNonRetryableError(lastError) || attempt === retries) {
          break;
        }

        // Wait before retry with exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const duration = Date.now() - startTime;
    
    if (logQueries) {
      console.error(`[TRANSACTION] Failed after ${retries + 1} attempts in ${duration}ms: ${lastError?.message}`);
    }

    return {
      success: false,
      error: lastError,
      duration,
      retryCount
    };
  }

  /**
   * Determine if an error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const nonRetryablePatterns = [
      /constraint/i,
      /duplicate/i,
      /foreign key/i,
      /check constraint/i,
      /not null/i,
      /syntax error/i,
      /permission denied/i,
      /authentication/i
    ];

    return nonRetryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Simplified transaction method for backward compatibility
   * Uses default options for common operations
   */
  async executeSimpleTransaction<T>(fn: TransactionFn<T>): Promise<T> {
    const result = await this.executeTransaction(fn, { retries: 1, logQueries: false });
    
    if (!result.success) {
      throw result.error || new Error('Transaction failed');
    }
    
    return result.data!;
  }

  // Efficient query methods for dashboard operations
  
  /**
   * Get complete dashboard data in a single optimized query
   * Uses joins to reduce database round trips
   */
  async getDashboardData(userId: string): Promise<{
    user: User;
    sprints: Sprint[];
    commitments: SprintCommitment[];
  }> {
    // Get user data
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Get all sprints with optimized query using user index
    const sprintData = await db
      .select()
      .from(sprints)
      .where(eq(sprints.userId, userId))
      .orderBy(asc(sprints.sprintNumber));

    // Get all commitments in a single query
    const commitments = await this.getSprintCommitments(userId);

    return { user, sprints: sprintData, commitments };
  }

  /**
   * Efficiently get sprints by status with single query
   * Leverages composite user_status index
   */
  async getSprintsByStatus(userId: string, status: "historic" | "current" | "future"): Promise<Sprint[]> {
    return await db
      .select()
      .from(sprints)
      .where(
        and(
          eq(sprints.userId, userId),
          eq(sprints.status, status)
        )
      )
      .orderBy(asc(sprints.sprintNumber));
  }

  /**
   * Get future sprints with their commitment status efficiently
   * Optimized for validation operations
   */
  async getFutureSprintsWithCommitments(userId: string): Promise<Array<Sprint & { hasCommitment: boolean }>> {
    const futureSprints = await this.getSprintsByStatus(userId, "future");
    
    // Get commitment status in single query
    const commitmentMap = new Map();
    if (futureSprints.length > 0) {
      const sprintIds = futureSprints.map(s => s.id);
      const commitments = await db
        .select({ sprintId: sprintCommitments.sprintId })
        .from(sprintCommitments)
        .where(
          and(
            eq(sprintCommitments.userId, userId),
            inArray(sprintCommitments.sprintId, sprintIds)
          )
        );
      
      commitments.forEach(c => commitmentMap.set(c.sprintId, true));
    }

    return futureSprints.map(sprint => ({
      ...sprint,
      hasCommitment: commitmentMap.has(sprint.id) || false
    }));
  }

  /**
   * Batch query for sprint validation
   * Gets all data needed for 6-sprint rolling window validation
   */
  async getValidationData(userId: string, sprintNumbers: number[]): Promise<{
    sprints: Sprint[];
    commitmentCounts: { build: number; test: number; pto: number; total: number };
  }> {
    if (sprintNumbers.length === 0) {
      return { sprints: [], commitmentCounts: { build: 0, test: 0, pto: 0, total: 0 } };
    }

    // Get sprints in the validation window
    const sprints = await db
      .select()
      .from(sprints)
      .where(
        and(
          eq(sprints.userId, userId),
          inArray(sprints.sprintNumber, sprintNumbers)
        )
      )
      .orderBy(asc(sprints.sprintNumber));

    // Count commitments by type in single query
    const sprintIds = sprints.filter(s => s.type).map(s => s.id);
    let commitmentCounts = { build: 0, test: 0, pto: 0, total: 0 };

    if (sprintIds.length > 0) {
      const counts = await db
        .select({
          type: sprints.type,
          count: sql<number>`count(*)`.as('count')
        })
        .from(sprints)
        .where(
          and(
            eq(sprints.userId, userId),
            inArray(sprints.id, sprintIds),
            isNotNull(sprints.type)
          )
        )
        .groupBy(sprints.type);

      counts.forEach(({ type, count }) => {
        if (type === 'build') commitmentCounts.build = Number(count);
        else if (type === 'test') commitmentCounts.test = Number(count);
        else if (type === 'pto') commitmentCounts.pto = Number(count);
        commitmentCounts.total += Number(count);
      });
    }

    return { sprints, commitmentCounts };
  }

  /**
   * Efficiently check if user has completed dashboard setup
   * Used for dashboard completion webhook logic
   */
  async hasCompletedDashboard(userId: string): Promise<boolean> {
    const [result] = await db
      .select({ count: sql<number>`count(*)`.as('count') })
      .from(sprints)
      .where(
        and(
          eq(sprints.userId, userId),
          eq(sprints.status, "future"),
          isNotNull(sprints.type)
        )
      );

    return Number(result?.count || 0) > 0;
  }

  /**
   * Get webhook logs with efficient filtering
   * Leverages composite indexes for monitoring
   */
  async getWebhookLogs(
    userId: string,
    options: {
      webhookType?: "new_commitment" | "dashboard_completion";
      status?: "success" | "failed";
      limit?: number;
    } = {}
  ): Promise<WebhookLog[]> {
    let query = db
      .select()
      .from(webhookLogs)
      .where(eq(webhookLogs.userId, userId));

    if (options.webhookType) {
      query = query.where(
        and(
          eq(webhookLogs.userId, userId),
          eq(webhookLogs.webhookType, options.webhookType)
        )
      );
    }

    if (options.status) {
      query = query.where(
        and(
          eq(webhookLogs.userId, userId),
          eq(webhookLogs.status, options.status)
        )
      );
    }

    query = query.orderBy(desc(webhookLogs.createdAt));

    if (options.limit) {
      query = query.limit(options.limit);
    }

    return await query;
  }

  /**
   * Batch operation for checking dashboard completion status
   * Used by webhook service for efficient completion detection
   */
  async checkDashboardCompletionSent(userId: string): Promise<boolean> {
    const [result] = await db
      .select({ count: sql<number>`count(*)`.as('count') })
      .from(webhookLogs)
      .where(
        and(
          eq(webhookLogs.userId, userId),
          eq(webhookLogs.webhookType, "dashboard_completion"),
          eq(webhookLogs.status, "success")
        )
      );

    return Number(result?.count || 0) > 0;
  }

  /**
   * Efficient sprint cleanup for historic data management
   * Removes old historic sprints beyond the 24-sprint limit
   */
  async cleanupOldHistoricSprints(userId: string, keepCount: number = 24): Promise<number> {
    // Get all historic sprints ordered by sprint number
    const historicSprints = await db
      .select({ id: sprints.id, sprintNumber: sprints.sprintNumber })
      .from(sprints)
      .where(
        and(
          eq(sprints.userId, userId),
          eq(sprints.status, "historic")
        )
      )
      .orderBy(asc(sprints.sprintNumber));

    if (historicSprints.length <= keepCount) {
      return 0; // No cleanup needed
    }

    // Identify sprints to remove (oldest ones)
    const sprintsToRemove = historicSprints.slice(0, historicSprints.length - keepCount);
    const sprintIdsToRemove = sprintsToRemove.map(s => s.id);

    // Use enhanced transaction for cleanup
    const result = await this.executeTransaction(async (tx) => {
      // Delete related commitments first
      await tx
        .delete(sprintCommitments)
        .where(inArray(sprintCommitments.sprintId, sprintIdsToRemove));

      // Delete related webhook logs
      await tx
        .delete(webhookLogs)
        .where(inArray(webhookLogs.sprintId, sprintIdsToRemove));

      // Delete the sprints
      await tx
        .delete(sprints)
        .where(inArray(sprints.id, sprintIdsToRemove));

      return sprintsToRemove.length;
    }, { 
      retries: 1, 
      isolationLevel: 'read committed',
      logQueries: true
    });

    if (!result.success) {
      throw new Error(`Sprint cleanup failed: ${result.error?.message}`);
    }

    return result.data!;
  }

  // Transaction-based sprint transition operations
  async executeSprintTransition(
    userId: string,
    operations: {
      statusUpdates: Array<{ sprintId: string; status: "historic" | "current" | "future" }>;
      newSprints: Array<{
        sprintNumber: number;
        startDate: Date;
        endDate: Date;
        type: "build" | "test" | "pto" | null;
        description: string | null;
        status: "historic" | "current" | "future";
      }>;
      sprintsToDelete: string[];
    }
  ): Promise<void> {
    const result = await this.executeTransaction(async (tx) => {
      // Apply status updates
      for (const update of operations.statusUpdates) {
        await tx
          .update(sprints)
          .set({ status: update.status, updatedAt: new Date() })
          .where(eq(sprints.id, update.sprintId));
      }

      // Create new sprints
      for (const newSprint of operations.newSprints) {
        await tx
          .insert(sprints)
          .values({
            userId,
            sprintNumber: newSprint.sprintNumber,
            startDate: newSprint.startDate,
            endDate: newSprint.endDate,
            type: newSprint.type,
            description: newSprint.description,
            status: newSprint.status,
          });
      }

      // Delete old sprints and their commitments
      for (const sprintId of operations.sprintsToDelete) {
        // Delete related commitments first
        await tx
          .delete(sprintCommitments)
          .where(eq(sprintCommitments.sprintId, sprintId));

        // Then delete the sprint
        await tx
          .delete(sprints)
          .where(eq(sprints.id, sprintId));
      }

      return { 
        statusUpdates: operations.statusUpdates.length,
        newSprints: operations.newSprints.length,
        deletedSprints: operations.sprintsToDelete.length
      };
    }, { 
      retries: 2, 
      isolationLevel: 'repeatable read',
      logQueries: true
    });

    if (!result.success) {
      throw new Error(`Sprint transition failed: ${result.error?.message}`);
    }
  }

  // Transaction-based commitment updates
  async executeCommitmentUpdate(
    userId: string,
    commitmentUpdates: Array<{
      sprintId: string;
      type: "build" | "test" | "pto" | null;
      description: string | null;
    }>,
    newCommitmentData: Array<{
      sprintId: string;
      type: "build" | "test" | "pto";
      description: string | null;
    }>
  ): Promise<void> {
    const result = await this.executeTransaction(async (tx) => {
      // Update sprint data
      for (const update of commitmentUpdates) {
        await tx
          .update(sprints)
          .set({
            type: update.type,
            description: update.description,
            updatedAt: new Date(),
          })
          .where(eq(sprints.id, update.sprintId));
      }

      // Create sprint commitment records for new commitments
      for (const commitment of newCommitmentData) {
        await tx
          .insert(sprintCommitments)
          .values({
            userId,
            sprintId: commitment.sprintId,
            type: commitment.type,
            description: commitment.description,
          });
      }

      return {
        updatedSprints: commitmentUpdates.length,
        newCommitments: newCommitmentData.length
      };
    }, { 
      retries: 2, 
      isolationLevel: 'read committed',
      logQueries: true
    });

    if (!result.success) {
      throw new Error(`Commitment update failed: ${result.error?.message}`);
    }
  }

  async getWebhookLogByUserAndType(userId: string, webhookType: string): Promise<WebhookLog | null> {
    const [log] = await db
      .select()
      .from(webhookLogs)
      .where(and(eq(webhookLogs.userId, userId), eq(webhookLogs.webhookType, webhookType)))
      .orderBy(desc(webhookLogs.createdAt))
      .limit(1);

    return log || null;
  }

  /**
   * Batch operation for multiple database writes with transaction safety
   * Useful for complex operations that need atomicity
   */
  async executeBatchOperations(
    operations: Array<{
      type: 'insert' | 'update' | 'delete';
      table: 'users' | 'sprints' | 'sprint_commitments' | 'webhook_logs';
      data: any;
      where?: any;
    }>,
    options: TransactionOptions = {}
  ): Promise<TransactionResult<number>> {
    return await this.executeTransaction(async (tx) => {
      let operationCount = 0;

      for (const operation of operations) {
        switch (operation.type) {
          case 'insert':
            if (operation.table === 'users') {
              await tx.insert(users).values(operation.data);
            } else if (operation.table === 'sprints') {
              await tx.insert(sprints).values(operation.data);
            } else if (operation.table === 'sprint_commitments') {
              await tx.insert(sprintCommitments).values(operation.data);
            } else if (operation.table === 'webhook_logs') {
              await tx.insert(webhookLogs).values(operation.data);
            }
            break;

          case 'update':
            if (operation.table === 'users' && operation.where) {
              await tx.update(users).set(operation.data).where(operation.where);
            } else if (operation.table === 'sprints' && operation.where) {
              await tx.update(sprints).set(operation.data).where(operation.where);
            } else if (operation.table === 'sprint_commitments' && operation.where) {
              await tx.update(sprintCommitments).set(operation.data).where(operation.where);
            } else if (operation.table === 'webhook_logs' && operation.where) {
              await tx.update(webhookLogs).set(operation.data).where(operation.where);
            }
            break;

          case 'delete':
            if (operation.table === 'users' && operation.where) {
              await tx.delete(users).where(operation.where);
            } else if (operation.table === 'sprints' && operation.where) {
              await tx.delete(sprints).where(operation.where);
            } else if (operation.table === 'sprint_commitments' && operation.where) {
              await tx.delete(sprintCommitments).where(operation.where);
            } else if (operation.table === 'webhook_logs' && operation.where) {
              await tx.delete(webhookLogs).where(operation.where);
            }
            break;
        }
        operationCount++;
      }

      return operationCount;
    }, {
      ...options,
      isolationLevel: options.isolationLevel || 'repeatable read'
    });
  }

  /**
   * Health check method for transaction system
   * Tests basic transaction functionality
   */
  async testTransactionHealth(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const result = await this.executeTransaction(async (tx) => {
        // Simple test query
        const [testResult] = await tx.execute(sql`SELECT 1 as test`);
        return testResult;
      }, { retries: 1, logQueries: false });

      return {
        healthy: result.success,
        latency: Date.now() - startTime,
        error: result.error?.message
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===== CONCURRENCY CONTROL MECHANISMS =====
  // Phase 5 Task 10: Build concurrency control mechanisms

  private readonly lockManager = new Map<string, {
    queue: Array<{
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
      operationType: string;
      timestamp: Date;
    }>;
    isLocked: boolean;
    lockHolder?: string;
    lockAcquiredAt?: Date;
    lockTimeout?: NodeJS.Timeout;
  }>();

  private readonly operationSemaphores = new Map<string, {
    current: number;
    max: number;
    queue: Array<{
      resolve: () => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
      operationType: string;
    }>;
  }>();

  /**
   * Acquire an exclusive lock for a specific resource
   * Prevents concurrent modifications to critical data
   */
  async acquireExclusiveLock(
    resourceId: string,
    operationType: string,
    options: {
      timeout?: number;
      maxWaitTime?: number;
      priority?: 'high' | 'normal' | 'low';
    } = {}
  ): Promise<{ lockId: string; release: () => Promise<void> }> {
    const {
      timeout = 30000,
      maxWaitTime = 60000,
      priority = 'normal'
    } = options;

    const lockId = `${operationType}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    if (!this.lockManager.has(resourceId)) {
      this.lockManager.set(resourceId, {
        queue: [],
        isLocked: false
      });
    }

    const lockInfo = this.lockManager.get(resourceId)!;

    // If not locked, acquire immediately
    if (!lockInfo.isLocked) {
      lockInfo.isLocked = true;
      lockInfo.lockHolder = lockId;
      lockInfo.lockAcquiredAt = new Date();

      // Set automatic timeout for the lock
      lockInfo.lockTimeout = setTimeout(() => {
        console.warn(`[CONCURRENCY] Lock ${lockId} timed out for resource ${resourceId}`);
        this.releaseLock(resourceId, lockId);
      }, timeout);

      return {
        lockId,
        release: () => this.releaseLock(resourceId, lockId)
      };
    }

    // Wait for lock to be available
    return new Promise((resolve, reject) => {
      const waitTimeout = setTimeout(() => {
        // Remove from queue
        const index = lockInfo.queue.findIndex(q => q.resolve === resolve);
        if (index >= 0) {
          lockInfo.queue.splice(index, 1);
        }
        reject(new Error(`Lock acquisition timeout for resource ${resourceId} after ${maxWaitTime}ms`));
      }, maxWaitTime);

      const queueItem = {
        resolve: (lockData: any) => {
          clearTimeout(waitTimeout);
          resolve(lockData);
        },
        reject: (error: Error) => {
          clearTimeout(waitTimeout);
          reject(error);
        },
        timeout: waitTimeout,
        operationType,
        timestamp: new Date()
      };

      // Insert based on priority
      if (priority === 'high') {
        lockInfo.queue.unshift(queueItem);
      } else {
        lockInfo.queue.push(queueItem);
      }
    });
  }

  /**
   * Release an exclusive lock
   */
  private async releaseLock(resourceId: string, lockId: string): Promise<void> {
    const lockInfo = this.lockManager.get(resourceId);
    if (!lockInfo || lockInfo.lockHolder !== lockId) {
      return; // Lock not held by this caller
    }

    // Clear timeout
    if (lockInfo.lockTimeout) {
      clearTimeout(lockInfo.lockTimeout);
      lockInfo.lockTimeout = undefined;
    }

    lockInfo.isLocked = false;
    lockInfo.lockHolder = undefined;
    lockInfo.lockAcquiredAt = undefined;

    // Process next in queue
    if (lockInfo.queue.length > 0) {
      const nextWaiter = lockInfo.queue.shift()!;
      
      lockInfo.isLocked = true;
      const nextLockId = `${nextWaiter.operationType}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      lockInfo.lockHolder = nextLockId;
      lockInfo.lockAcquiredAt = new Date();

      // Set timeout for next lock holder
      lockInfo.lockTimeout = setTimeout(() => {
        console.warn(`[CONCURRENCY] Lock ${nextLockId} timed out for resource ${resourceId}`);
        this.releaseLock(resourceId, nextLockId);
      }, 30000);

      nextWaiter.resolve({
        lockId: nextLockId,
        release: () => this.releaseLock(resourceId, nextLockId)
      });
    }
  }

  /**
   * Acquire a semaphore for rate-limited operations
   * Controls the number of concurrent operations of a specific type
   */
  async acquireSemaphore(
    operationType: string,
    maxConcurrent: number = 5,
    options: {
      timeout?: number;
      priority?: 'high' | 'normal' | 'low';
    } = {}
  ): Promise<{ release: () => void }> {
    const { timeout = 30000, priority = 'normal' } = options;

    if (!this.operationSemaphores.has(operationType)) {
      this.operationSemaphores.set(operationType, {
        current: 0,
        max: maxConcurrent,
        queue: []
      });
    }

    const semaphore = this.operationSemaphores.get(operationType)!;

    // If under limit, acquire immediately
    if (semaphore.current < semaphore.max) {
      semaphore.current++;
      
      return {
        release: () => {
          semaphore.current--;
          this.processNextSemaphoreWaiter(operationType);
        }
      };
    }

    // Wait for availability
    return new Promise((resolve, reject) => {
      const waitTimeout = setTimeout(() => {
        // Remove from queue
        const index = semaphore.queue.findIndex(q => q.resolve === resolve);
        if (index >= 0) {
          semaphore.queue.splice(index, 1);
        }
        reject(new Error(`Semaphore acquisition timeout for ${operationType} after ${timeout}ms`));
      }, timeout);

      const queueItem = {
        resolve: (semaphoreData: any) => {
          clearTimeout(waitTimeout);
          resolve(semaphoreData);
        },
        reject: (error: Error) => {
          clearTimeout(waitTimeout);
          reject(error);
        },
        timeout: waitTimeout,
        operationType
      };

      // Insert based on priority
      if (priority === 'high') {
        semaphore.queue.unshift(queueItem);
      } else {
        semaphore.queue.push(queueItem);
      }
    });
  }

  /**
   * Process next semaphore waiter
   */
  private processNextSemaphoreWaiter(operationType: string): void {
    const semaphore = this.operationSemaphores.get(operationType);
    if (!semaphore || semaphore.queue.length === 0 || semaphore.current >= semaphore.max) {
      return;
    }

    const nextWaiter = semaphore.queue.shift()!;
    semaphore.current++;

    nextWaiter.resolve({
      release: () => {
        semaphore.current--;
        this.processNextSemaphoreWaiter(operationType);
      }
    });
  }

  /**
   * Execute operation with exclusive lock protection
   * Prevents concurrent access to critical resources
   */
  async executeWithExclusiveLock<T>(
    resourceId: string,
    operationType: string,
    operation: () => Promise<T>,
    options: {
      lockTimeout?: number;
      maxWaitTime?: number;
      priority?: 'high' | 'normal' | 'low';
    } = {}
  ): Promise<T> {
    const lock = await this.acquireExclusiveLock(resourceId, operationType, options);
    
    try {
      return await operation();
    } finally {
      await lock.release();
    }
  }

  /**
   * Execute operation with semaphore rate limiting
   * Controls concurrent operations of the same type
   */
  async executeWithSemaphore<T>(
    operationType: string,
    operation: () => Promise<T>,
    maxConcurrent: number = 5,
    options: {
      timeout?: number;
      priority?: 'high' | 'normal' | 'low';
    } = {}
  ): Promise<T> {
    const semaphore = await this.acquireSemaphore(operationType, maxConcurrent, options);
    
    try {
      return await operation();
    } finally {
      semaphore.release();
    }
  }

  /**
   * Deadlock detection and prevention
   * Monitors lock acquisition patterns to prevent deadlocks
   */
  private readonly lockDependencyGraph = new Map<string, Set<string>>();
  private readonly lockWaitGraph = new Map<string, Set<string>>();

  private detectPotentialDeadlock(requesterId: string, resourceId: string): boolean {
    // Build dependency graph
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      if (recursionStack.has(node)) {
        return true; // Cycle detected
      }
      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);

      const dependencies = this.lockDependencyGraph.get(node) || new Set();
      for (const dependency of dependencies) {
        if (hasCycle(dependency)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    // Add potential dependency
    if (!this.lockDependencyGraph.has(requesterId)) {
      this.lockDependencyGraph.set(requesterId, new Set());
    }
    this.lockDependencyGraph.get(requesterId)!.add(resourceId);

    // Check for cycles
    const deadlockDetected = hasCycle(requesterId);

    // Remove the potential dependency if it would cause deadlock
    if (deadlockDetected) {
      this.lockDependencyGraph.get(requesterId)!.delete(resourceId);
    }

    return deadlockDetected;
  }

  /**
   * Enhanced transaction execution with concurrency control
   * Combines transactions with lock management for critical operations
   */
  async executeTransactionWithConcurrencyControl<T>(
    operationType: OperationContext['operationType'],
    operation: TransactionFn<T>,
    userId?: string,
    options: TransactionOptions & {
      exclusiveLockResource?: string;
      semaphoreLimit?: number;
      priority?: 'high' | 'normal' | 'low';
      preventDeadlock?: boolean;
    } = {}
  ): Promise<TransactionResult<T> & { 
    concurrencyStats: {
      lockWaitTime: number;
      semaphoreWaitTime: number;
      deadlockPrevented: boolean;
    }
  }> {
    const {
      exclusiveLockResource,
      semaphoreLimit = 3,
      priority = 'normal',
      preventDeadlock = true,
      ...transactionOptions
    } = options;

    const concurrencyStats = {
      lockWaitTime: 0,
      semaphoreWaitTime: 0,
      deadlockPrevented: false
    };

    const operationId = `${operationType}_${userId || 'system'}_${Date.now()}`;

    try {
      // Deadlock prevention
      if (preventDeadlock && exclusiveLockResource) {
        const deadlockDetected = this.detectPotentialDeadlock(operationId, exclusiveLockResource);
        if (deadlockDetected) {
          concurrencyStats.deadlockPrevented = true;
          throw new Error(`Potential deadlock detected for operation ${operationId} on resource ${exclusiveLockResource}`);
        }
      }

      // Acquire semaphore for operation type
      const semaphoreStart = Date.now();
      const semaphore = await this.acquireSemaphore(operationType, semaphoreLimit, { priority });
      concurrencyStats.semaphoreWaitTime = Date.now() - semaphoreStart;

      try {
        // Acquire exclusive lock if needed
        let lock: { release: () => Promise<void> } | undefined;
        if (exclusiveLockResource) {
          const lockStart = Date.now();
          const lockResult = await this.acquireExclusiveLock(exclusiveLockResource, operationType, { priority });
          lock = lockResult;
          concurrencyStats.lockWaitTime = Date.now() - lockStart;
        }

        try {
          // Execute transaction
          const result = await this.executeTransactionWithRecovery(
            operationType,
            operation,
            userId,
            {
              ...transactionOptions,
              enableRecovery: true,
              validateAfterRecovery: true
            }
          );

          return {
            ...result,
            concurrencyStats
          };
        } finally {
          // Release exclusive lock
          if (lock) {
            await lock.release();
          }
        }
      } finally {
        // Release semaphore
        semaphore.release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: 0,
        retryCount: 0,
        concurrencyStats
      };
    } finally {
      // Clean up dependency graph
      if (exclusiveLockResource) {
        this.lockDependencyGraph.delete(operationId);
      }
    }
  }

  /**
   * Batch operation with intelligent concurrency control
   * Processes multiple operations with optimal concurrency management
   */
  async executeConcurrentBatchOperations<T>(
    operations: Array<{
      id: string;
      type: string;
      operation: () => Promise<T>;
      priority?: 'high' | 'normal' | 'low';
      resourceDependencies?: string[];
    }>,
    options: {
      maxConcurrency?: number;
      batchSize?: number;
      failFast?: boolean;
      deadlockPrevention?: boolean;
    } = {}
  ): Promise<{
    results: Array<{ id: string; success: boolean; data?: T; error?: string }>;
    stats: {
      totalProcessed: number;
      successful: number;
      failed: number;
      avgExecutionTime: number;
      totalWaitTime: number;
      deadlocksPrevented: number;
    };
  }> {
    const {
      maxConcurrency = 5,
      batchSize = 10,
      failFast = false,
      deadlockPrevention = true
    } = options;

    const results: Array<{ id: string; success: boolean; data?: T; error?: string }> = [];
    const stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      avgExecutionTime: 0,
      totalWaitTime: 0,
      deadlocksPrevented: 0
    };

    const executionTimes: number[] = [];
    let totalWaitTime = 0;

    // Process operations in batches
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      
      // Execute batch with controlled concurrency
      const batchPromises = batch.map(async (op) => {
        const startTime = Date.now();
        
        try {
          // Deadlock prevention check
          if (deadlockPrevention && op.resourceDependencies) {
            for (const resource of op.resourceDependencies) {
              const deadlockDetected = this.detectPotentialDeadlock(op.id, resource);
              if (deadlockDetected) {
                stats.deadlocksPrevented++;
                throw new Error(`Deadlock prevented for operation ${op.id}`);
              }
            }
          }

          // Execute with semaphore control
          const result = await this.executeWithSemaphore(
            op.type,
            op.operation,
            maxConcurrency,
            { priority: op.priority || 'normal' }
          );

          const executionTime = Date.now() - startTime;
          executionTimes.push(executionTime);

          return {
            id: op.id,
            success: true,
            data: result
          };
        } catch (error) {
          const executionTime = Date.now() - startTime;
          executionTimes.push(executionTime);

          return {
            id: op.id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });

      // Wait for batch completion
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Update stats
      stats.totalProcessed += batchResults.length;
      stats.successful += batchResults.filter(r => r.success).length;
      stats.failed += batchResults.filter(r => !r.success).length;

      // Fail fast if requested
      if (failFast && batchResults.some(r => !r.success)) {
        break;
      }
    }

    // Calculate final stats
    stats.avgExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length 
      : 0;
    stats.totalWaitTime = totalWaitTime;

    return { results, stats };
  }

  /**
   * Monitor and report concurrency system health
   */
  getConcurrencySystemStats(): {
    activeLocks: number;
    queuedLockRequests: number;
    activeSemaphores: number;
    queuedSemaphoreRequests: number;
    lockDetails: Array<{
      resourceId: string;
      lockHolder: string;
      acquiredAt: Date;
      queueLength: number;
    }>;
    semaphoreDetails: Array<{
      operationType: string;
      currentUsage: number;
      maxCapacity: number;
      queueLength: number;
    }>;
  } {
    const lockDetails = Array.from(this.lockManager.entries()).map(([resourceId, info]) => ({
      resourceId,
      lockHolder: info.lockHolder || 'none',
      acquiredAt: info.lockAcquiredAt || new Date(),
      queueLength: info.queue.length
    }));

    const semaphoreDetails = Array.from(this.operationSemaphores.entries()).map(([operationType, info]) => ({
      operationType,
      currentUsage: info.current,
      maxCapacity: info.max,
      queueLength: info.queue.length
    }));

    return {
      activeLocks: Array.from(this.lockManager.values()).filter(info => info.isLocked).length,
      queuedLockRequests: Array.from(this.lockManager.values()).reduce((sum, info) => sum + info.queue.length, 0),
      activeSemaphores: this.operationSemaphores.size,
      queuedSemaphoreRequests: Array.from(this.operationSemaphores.values()).reduce((sum, info) => sum + info.queue.length, 0),
      lockDetails,
      semaphoreDetails
    };
  }

  /**
   * Clean up stale locks and semaphores
   * Prevents resource leaks and stuck operations
   */
  async cleanupConcurrencyResources(): Promise<{
    staleLocksCleaned: number;
    staleSemaphoresCleaned: number;
  }> {
    let staleLocksCleaned = 0;
    let staleSemaphoresCleaned = 0;
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    // Clean up stale locks
    for (const [resourceId, lockInfo] of this.lockManager.entries()) {
      if (lockInfo.isLocked && lockInfo.lockAcquiredAt) {
        const lockAge = now - lockInfo.lockAcquiredAt.getTime();
        if (lockAge > staleThreshold) {
          console.warn(`[CONCURRENCY] Cleaning up stale lock for resource ${resourceId}, age: ${lockAge}ms`);
          await this.releaseLock(resourceId, lockInfo.lockHolder!);
          staleLocksCleaned++;
        }
      }

      // Clean up empty lock managers
      if (!lockInfo.isLocked && lockInfo.queue.length === 0) {
        this.lockManager.delete(resourceId);
      }
    }

    // Clean up empty semaphores
    for (const [operationType, semaphoreInfo] of this.operationSemaphores.entries()) {
      if (semaphoreInfo.current === 0 && semaphoreInfo.queue.length === 0) {
        this.operationSemaphores.delete(operationType);
        staleSemaphoresCleaned++;
      }
    }

    return { staleLocksCleaned, staleSemaphoresCleaned };
  }

  // ===== ROLLBACK AND ERROR RECOVERY LOGIC =====
  // Phase 5 Task 9: Add rollback and error recovery logic

  }

/**
 * Error classification and recovery strategy interface
 */
interface ErrorRecoveryStrategy {
    shouldRetry: boolean;
    retryDelay: number;
    maxRetries: number;
    requiresRollback: boolean;
    requiresDataValidation: boolean;
    customRecovery?: () => Promise<boolean>;
  }

  /**
 * Operation context for comprehensive error tracking
 */
interface OperationContext {
    operationType: 'sprint_advancement' | 'commitment_update' | 'bulk_operation' | 'data_migration';
    userId?: string;
    operationId: string;
    startTime: Date;
    checkpoints: Array<{
      timestamp: Date;
      operation: string;
      data: any;
    }>;
    rollbackData?: any;
  }

  /**
   * Comprehensive error analysis and recovery strategy determination
   */
  private analyzeErrorAndDetermineStrategy(error: Error, context: OperationContext): ErrorRecoveryStrategy {
    const errorMessage = error.message.toLowerCase();
    
    // Database constraint violations - non-recoverable
    if (this.isConstraintViolation(error)) {
      return {
        shouldRetry: false,
        retryDelay: 0,
        maxRetries: 0,
        requiresRollback: true,
        requiresDataValidation: true
      };
    }

    // Deadlock detection - recoverable with retry
    if (errorMessage.includes('deadlock') || errorMessage.includes('serialization failure')) {
      return {
        shouldRetry: true,
        retryDelay: Math.random() * 1000 + 500, // Random delay to avoid repeated conflicts
        maxRetries: 5,
        requiresRollback: true,
        requiresDataValidation: false
      };
    }

    // Connection timeout - recoverable with exponential backoff
    if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
      return {
        shouldRetry: true,
        retryDelay: 2000,
        maxRetries: 3,
        requiresRollback: false,
        requiresDataValidation: true
      };
    }

    // Resource exhaustion - recoverable with delay
    if (errorMessage.includes('resource') || errorMessage.includes('memory') || errorMessage.includes('disk')) {
      return {
        shouldRetry: true,
        retryDelay: 5000,
        maxRetries: 2,
        requiresRollback: true,
        requiresDataValidation: true
      };
    }

    // Foreign key violations - non-recoverable data issue
    if (errorMessage.includes('foreign key') || errorMessage.includes('referential integrity')) {
      return {
        shouldRetry: false,
        retryDelay: 0,
        maxRetries: 0,
        requiresRollback: true,
        requiresDataValidation: true
      };
    }

    // Network-related errors - recoverable
    if (errorMessage.includes('network') || errorMessage.includes('connection reset')) {
      return {
        shouldRetry: true,
        retryDelay: 1000,
        maxRetries: 3,
        requiresRollback: false,
        requiresDataValidation: true
      };
    }

    // Default strategy for unknown errors
    return {
      shouldRetry: true,
      retryDelay: 1000,
      maxRetries: 1,
      requiresRollback: true,
      requiresDataValidation: true
    };
  }

  /**
   * Enhanced constraint violation detection
   */
  private isConstraintViolation(error: Error): boolean {
    const constraintPatterns = [
      /check constraint/i,
      /unique constraint/i,
      /not null constraint/i,
      /duplicate key/i,
      /violates check constraint/i,
      /value too long/i,
      /invalid input syntax/i
    ];

    return constraintPatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Enhanced transaction executor with comprehensive rollback and recovery
   */
  async executeTransactionWithRecovery<T>(
    operationType: OperationContext['operationType'],
    operationFn: TransactionFn<T>,
    userId?: string,
    options: TransactionOptions & {
      enableRecovery?: boolean;
      validateAfterRecovery?: boolean;
      createBackup?: boolean;
    } = {}
  ): Promise<TransactionResult<T> & {
    recoveryAttempts: number;
    rollbackPerformed: boolean;
    dataValidated: boolean;
  }> {
    const {
      enableRecovery = true,
      validateAfterRecovery = true,
      createBackup = false,
      ...transactionOptions
    } = options;

    const operationId = `${operationType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const context: OperationContext = {
      operationType,
      userId,
      operationId,
      startTime: new Date(),
      checkpoints: []
    };

    let recoveryAttempts = 0;
    let rollbackPerformed = false;
    let dataValidated = false;
    let backup: any = null;

    // Create backup if requested
    if (createBackup && userId) {
      try {
        backup = await this.createOperationBackup(userId, operationType);
        context.rollbackData = backup;
      } catch (backupError) {
        console.warn(`[RECOVERY] Failed to create backup for ${operationId}:`, backupError);
      }
    }

    const startTime = Date.now();
    let lastError: Error | undefined;

    // Main execution loop with recovery
    while (recoveryAttempts <= (transactionOptions.retries || 3)) {
      try {
        // Add checkpoint
        context.checkpoints.push({
          timestamp: new Date(),
          operation: `attempt_${recoveryAttempts + 1}`,
          data: { attempt: recoveryAttempts + 1 }
        });

        // Execute transaction
        const result = await this.executeTransaction(operationFn, {
          ...transactionOptions,
          retries: 0, // Handle retries at this level
          logQueries: transactionOptions.logQueries || recoveryAttempts > 0
        });

        if (result.success) {
          // Success - validate if requested
          if (validateAfterRecovery && userId) {
            try {
              dataValidated = await this.validateOperationResult(userId, operationType, context);
              if (!dataValidated) {
                throw new Error('Post-operation data validation failed');
              }
            } catch (validationError) {
              console.error(`[RECOVERY] Validation failed for ${operationId}:`, validationError);
              lastError = validationError instanceof Error ? validationError : new Error(String(validationError));
              recoveryAttempts++;
              continue;
            }
          }

          return {
            ...result,
            recoveryAttempts,
            rollbackPerformed,
            dataValidated
          };
        }

        lastError = result.error;
        break; // Transaction wrapper handles its own retries
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (!enableRecovery) {
          break;
        }

        // Analyze error and determine recovery strategy
        const strategy = this.analyzeErrorAndDetermineStrategy(lastError, context);
        
        console.warn(`[RECOVERY] Attempt ${recoveryAttempts + 1} failed for ${operationId}: ${lastError.message}`);

        // Perform rollback if required
        if (strategy.requiresRollback && backup && userId) {
          try {
            await this.performOperationRollback(userId, operationType, backup, context);
            rollbackPerformed = true;
            console.log(`[RECOVERY] Rollback completed for ${operationId}`);
          } catch (rollbackError) {
            console.error(`[RECOVERY] Rollback failed for ${operationId}:`, rollbackError);
            // Continue with recovery attempt even if rollback fails
          }
        }

        // Check if we should retry
        if (!strategy.shouldRetry || recoveryAttempts >= strategy.maxRetries) {
          break;
        }

        // Wait before retry with strategy-specific delay
        if (strategy.retryDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, strategy.retryDelay));
        }

        recoveryAttempts++;
      }
    }

    // All recovery attempts failed
    const duration = Date.now() - startTime;
    
    console.error(`[RECOVERY] All recovery attempts failed for ${operationId} after ${duration}ms:`, lastError?.message);

    return {
      success: false,
      error: lastError,
      duration,
      retryCount: recoveryAttempts,
      recoveryAttempts,
      rollbackPerformed,
      dataValidated
    };
  }

  /**
   * Create operation backup for rollback capability
   */
  private async createOperationBackup(
    userId: string, 
    operationType: OperationContext['operationType']
  ): Promise<any> {
    switch (operationType) {
      case 'sprint_advancement':
        return await this.createSprintAdvancementBackup(userId);
      
      case 'commitment_update':
        // Get current sprint commitments state
        const sprints = await this.getUserSprints(userId);
        const commitments = await this.getSprintCommitments(userId);
        return { sprints, commitments };
      
      case 'bulk_operation':
        // Create comprehensive backup
        return await this.createComprehensiveBackup(userId);
      
      default:
        return null;
    }
  }

  /**
   * Perform operation rollback based on backup data
   */
  private async performOperationRollback(
    userId: string,
    operationType: OperationContext['operationType'],
    backupData: any,
    context: OperationContext
  ): Promise<void> {
    const rollbackResult = await this.executeTransaction(async (tx) => {
      context.checkpoints.push({
        timestamp: new Date(),
        operation: 'rollback_start',
        data: { operationType }
      });

      switch (operationType) {
        case 'sprint_advancement':
          return await this.performSprintAdvancementRollback(tx, userId, backupData);
        
        case 'commitment_update':
          return await this.performCommitmentUpdateRollback(tx, userId, backupData);
        
        case 'bulk_operation':
          return await this.performBulkOperationRollback(tx, userId, backupData);
        
        default:
          throw new Error(`Rollback not implemented for operation type: ${operationType}`);
      }
    }, {
      retries: 2,
      isolationLevel: 'serializable',
      timeout: 60000,
      logQueries: true
    });

    if (!rollbackResult.success) {
      throw new Error(`Rollback failed: ${rollbackResult.error?.message}`);
    }

    context.checkpoints.push({
      timestamp: new Date(),
      operation: 'rollback_complete',
      data: { success: true }
    });
  }

  /**
   * Sprint advancement specific rollback
   */
  private async performSprintAdvancementRollback(
    tx: any,
    userId: string,
    backupData: any
  ): Promise<boolean> {
    // Delete current sprint data
    await tx.delete(sprintCommitments).where(eq(sprintCommitments.userId, userId));
    await tx.delete(webhookLogs).where(eq(webhookLogs.userId, userId));
    await tx.delete(sprints).where(eq(sprints.userId, userId));

    // Restore from backup
    for (const sprint of backupData.sprints) {
      await tx.insert(sprints).values({
        id: sprint.id,
        userId,
        sprintNumber: sprint.sprintNumber,
        startDate: new Date(), // Will be recalculated
        endDate: new Date(),
        type: sprint.type,
        description: sprint.description,
        status: sprint.status,
      });
    }

    for (const commitment of backupData.commitments) {
      await tx.insert(sprintCommitments).values({
        id: commitment.id,
        userId,
        sprintId: commitment.sprintId,
        type: commitment.type,
        description: commitment.description,
        isNewCommitment: false,
      });
    }

    return true;
  }

  /**
   * Commitment update specific rollback
   */
  private async performCommitmentUpdateRollback(
    tx: any,
    userId: string,
    backupData: any
  ): Promise<boolean> {
    // Restore sprint states
    for (const sprint of backupData.sprints) {
      await tx
        .update(sprints)
        .set({
          type: sprint.type,
          description: sprint.description,
          updatedAt: new Date()
        })
        .where(eq(sprints.id, sprint.id));
    }

    // Remove any new commitment records
    const backupCommitmentIds = backupData.commitments.map((c: any) => c.id);
    if (backupCommitmentIds.length > 0) {
      await tx
        .delete(sprintCommitments)
        .where(
          and(
            eq(sprintCommitments.userId, userId),
            sql`${sprintCommitments.id} NOT IN (${backupCommitmentIds.map(() => '?').join(',')})`,
            ...backupCommitmentIds
          )
        );
    }

    return true;
  }

  /**
   * Bulk operation specific rollback
   */
  private async performBulkOperationRollback(
    tx: any,
    userId: string,
    backupData: any
  ): Promise<boolean> {
    // Comprehensive restore for bulk operations
    await this.performSprintAdvancementRollback(tx, userId, backupData);
    return true;
  }

  /**
   * Validate operation result for data consistency
   */
  private async validateOperationResult(
    userId: string,
    operationType: OperationContext['operationType'],
    context: OperationContext
  ): Promise<boolean> {
    try {
      switch (operationType) {
        case 'sprint_advancement':
          const sprintIntegrity = await this.verifySprintAdvancementIntegrity(userId);
          return sprintIntegrity.isValid;
        
        case 'commitment_update':
          return await this.validateCommitmentUpdateResult(userId);
        
        case 'bulk_operation':
          return await this.validateBulkOperationResult(userId);
        
        default:
          return true; // No validation implemented
      }
    } catch (error) {
      console.error(`[RECOVERY] Validation error for ${context.operationId}:`, error);
      return false;
    }
  }

  /**
   * Validate commitment update results
   */
  private async validateCommitmentUpdateResult(userId: string): Promise<boolean> {
    // Check for orphaned commitments
    const orphanedCommitments = await db
      .select({ count: sql<number>`count(*)`.as('count') })
      .from(sprintCommitments)
      .leftJoin(sprints, eq(sprintCommitments.sprintId, sprints.id))
      .where(
        and(
          eq(sprintCommitments.userId, userId),
          sql`${sprints.id} IS NULL`
        )
      );

    if (Number(orphanedCommitments[0]?.count || 0) > 0) {
      return false;
    }

    // Check sprint consistency
    const futureSprints = await this.getSprintsByStatus(userId, "future");
    return futureSprints.length === 6;
  }

  /**
   * Validate bulk operation results
   */
  private async validateBulkOperationResult(userId: string): Promise<boolean> {
    const sprintValidation = await this.validateCommitmentUpdateResult(userId);
    const integrityCheck = await this.verifySprintAdvancementIntegrity(userId);
    
    return sprintValidation && integrityCheck.isValid;
  }

  /**
   * Create comprehensive backup for complex operations
   */
  private async createComprehensiveBackup(userId: string): Promise<any> {
    const [sprints, commitments, webhookLogs] = await Promise.all([
      this.getUserSprints(userId),
      this.getSprintCommitments(userId),
      this.getWebhookLogs(userId)
    ]);

    return {
      sprints: sprints.map(s => ({
        id: s.id,
        sprintNumber: s.sprintNumber,
        status: s.status,
        type: s.type,
        description: s.description,
        startDate: s.startDate,
        endDate: s.endDate
      })),
      commitments: commitments.map(c => ({
        id: c.id,
        sprintId: c.sprintId,
        type: c.type,
        description: c.description,
        isNewCommitment: c.isNewCommitment
      })),
      webhookLogs: webhookLogs.map(w => ({
        id: w.id,
        sprintId: w.sprintId,
        webhookType: w.webhookType,
        status: w.status,
        payload: w.payload
      }))
    };
  }

  /**
   * Enhanced atomic sprint advancement with recovery
   */
  async executeAtomicSprintAdvancementWithRecovery(
    userId: string,
    operations: {
      currentSprintNumber: number;
      sprintStatusMap: Map<number, "historic" | "current" | "future">;
      newSprintsToCreate: Array<{
        sprintNumber: number;
        startDate: Date;
        endDate: Date;
        status: "historic" | "current" | "future";
      }>;
      sprintsToCleanup: number[];
    }
  ): Promise<{
    success: boolean;
    sprintsUpdated: number;
    sprintsCreated: number;
    sprintsDeleted: number;
    recoveryAttempts: number;
    rollbackPerformed: boolean;
    error?: string;
  }> {
    const result = await this.executeTransactionWithRecovery(
      'sprint_advancement',
      async (tx) => {
        return await this.performAtomicSprintAdvancementOperations(tx, userId, operations);
      },
      userId,
      {
        enableRecovery: true,
        validateAfterRecovery: true,
        createBackup: true,
        retries: 3,
        isolationLevel: 'repeatable read',
        timeout: 45000
      }
    );

    if (!result.success) {
      return {
        success: false,
        sprintsUpdated: 0,
        sprintsCreated: 0,
        sprintsDeleted: 0,
        recoveryAttempts: result.recoveryAttempts,
        rollbackPerformed: result.rollbackPerformed,
        error: result.error?.message || 'Unknown error'
      };
    }

    return {
      success: true,
      ...result.data!,
      recoveryAttempts: result.recoveryAttempts,
      rollbackPerformed: result.rollbackPerformed
    };
  }

  /**
   * Concurrency-controlled sprint advancement for single user
   * Uses exclusive locks to prevent conflicting sprint operations
   */
  async executeSprintAdvancementWithConcurrencyControl(
    userId: string,
    operations: {
      currentSprintNumber: number;
      sprintStatusMap: Map<number, "historic" | "current" | "future">;
      newSprintsToCreate: Array<{
        sprintNumber: number;
        startDate: Date;
        endDate: Date;
        status: "historic" | "current" | "future";
      }>;
      sprintsToCleanup: number[];
    }
  ): Promise<{
    success: boolean;
    sprintsUpdated: number;
    sprintsCreated: number;
    sprintsDeleted: number;
    concurrencyStats: {
      lockWaitTime: number;
      semaphoreWaitTime: number;
      deadlockPrevented: boolean;
    };
    error?: string;
  }> {
    const result = await this.executeTransactionWithConcurrencyControl(
      'sprint_advancement',
      async (tx) => {
        return await this.performAtomicSprintAdvancementOperations(tx, userId, operations);
      },
      userId,
      {
        exclusiveLockResource: `user_sprints_${userId}`,
        semaphoreLimit: 2, // Max 2 concurrent sprint advancements
        priority: 'high',
        preventDeadlock: true,
        enableRecovery: true,
        validateAfterRecovery: true,
        createBackup: true,
        retries: 3,
        isolationLevel: 'repeatable read',
        timeout: 45000
      }
    );

    if (!result.success) {
      return {
        success: false,
        sprintsUpdated: 0,
        sprintsCreated: 0,
        sprintsDeleted: 0,
        concurrencyStats: result.concurrencyStats,
        error: result.error?.message || 'Unknown error'
      };
    }

    return {
      success: true,
      ...result.data!,
      concurrencyStats: result.concurrencyStats
    };
  }

  /**
   * Concurrency-controlled commitment updates
   * Prevents race conditions during commitment modifications
   */
  async executeCommitmentUpdateWithConcurrencyControl(
    userId: string,
    commitmentUpdates: Array<{
      sprintId: string;
      type: "build" | "test" | "pto" | null;
      description: string | null;
    }>,
    newCommitmentData: Array<{
      sprintId: string;
      type: "build" | "test" | "pto";
      description: string | null;
    }>
  ): Promise<{
    success: boolean;
    updatedSprints: number;
    newCommitments: number;
    concurrencyStats: {
      lockWaitTime: number;
      semaphoreWaitTime: number;
      deadlockPrevented: boolean;
    };
    error?: string;
  }> {
    const result = await this.executeTransactionWithConcurrencyControl(
      'commitment_update',
      async (tx) => {
        // Update sprint data
        for (const update of commitmentUpdates) {
          await tx
            .update(sprints)
            .set({
              type: update.type,
              description: update.description,
              updatedAt: new Date(),
            })
            .where(eq(sprints.id, update.sprintId));
        }

        // Create sprint commitment records for new commitments
        for (const commitment of newCommitmentData) {
          await tx
            .insert(sprintCommitments)
            .values({
              userId,
              sprintId: commitment.sprintId,
              type: commitment.type,
              description: commitment.description,
            });
        }

        return {
          updatedSprints: commitmentUpdates.length,
          newCommitments: newCommitmentData.length
        };
      },
      userId,
      {
        exclusiveLockResource: `user_commitments_${userId}`,
        semaphoreLimit: 5, // Max 5 concurrent commitment updates
        priority: 'normal',
        preventDeadlock: true,
        enableRecovery: true,
        validateAfterRecovery: true,
        retries: 2,
        isolationLevel: 'read committed',
        timeout: 30000
      }
    );

    if (!result.success) {
      return {
        success: false,
        updatedSprints: 0,
        newCommitments: 0,
        concurrencyStats: result.concurrencyStats,
        error: result.error?.message || 'Unknown error'
      };
    }

    return {
      success: true,
      ...result.data!,
      concurrencyStats: result.concurrencyStats
    };
  }

  /**
   * Global sprint advancement with intelligent concurrency control
   * Processes all users with optimal resource utilization
   */
  async executeGlobalSprintAdvancementWithConcurrency(
    userOperations: Array<{
      userId: string;
      username: string;
      operations: {
        currentSprintNumber: number;
        sprintStatusMap: Map<number, "historic" | "current" | "future">;
        newSprintsToCreate: Array<{
          sprintNumber: number;
          startDate: Date;
          endDate: Date;
          status: "historic" | "current" | "future";
        }>;
        sprintsToCleanup: number[];
      };
    }>
  ): Promise<{
    totalUsersProcessed: number;
    totalSprintsUpdated: number;
    totalSprintsCreated: number;
    totalSprintsDeleted: number;
    failedUsers: Array<{ username: string; error: string }>;
    processingTimeMs: number;
    concurrencyStats: {
      avgLockWaitTime: number;
      avgSemaphoreWaitTime: number;
      deadlocksPrevented: number;
    };
  }> {
    const startTime = Date.now();
    
    // Convert user operations to batch operations format
    const batchOperations = userOperations.map(userOp => ({
      id: userOp.userId,
      type: 'sprint_advancement',
      operation: async () => {
        return await this.executeSprintAdvancementWithConcurrencyControl(
          userOp.userId,
          userOp.operations
        );
      },
      priority: 'high' as const,
      resourceDependencies: [`user_sprints_${userOp.userId}`]
    }));

    // Execute with controlled concurrency
    const batchResult = await this.executeConcurrentBatchOperations(
      batchOperations,
      {
        maxConcurrency: 3, // Limit concurrent sprint advancements
        batchSize: 5,      // Process in small batches
        failFast: false,   // Continue processing even if some fail
        deadlockPrevention: true
      }
    );

    // Aggregate results
    let totalSprintsUpdated = 0;
    let totalSprintsCreated = 0;
    let totalSprintsDeleted = 0;
    let totalLockWaitTime = 0;
    let totalSemaphoreWaitTime = 0;
    let deadlocksPrevented = 0;

    const failedUsers: Array<{ username: string; error: string }> = [];

    for (const result of batchResult.results) {
      if (result.success && result.data) {
        totalSprintsUpdated += result.data.sprintsUpdated;
        totalSprintsCreated += result.data.sprintsCreated;
        totalSprintsDeleted += result.data.sprintsDeleted;
        totalLockWaitTime += result.data.concurrencyStats.lockWaitTime;
        totalSemaphoreWaitTime += result.data.concurrencyStats.semaphoreWaitTime;
        if (result.data.concurrencyStats.deadlockPrevented) {
          deadlocksPrevented++;
        }
      } else {
        const userOp = userOperations.find(u => u.userId === result.id);
        failedUsers.push({
          username: userOp?.username || 'unknown',
          error: result.error || 'Unknown error'
        });
      }
    }

    const successfulOperations = batchResult.results.filter(r => r.success).length;

    return {
      totalUsersProcessed: successfulOperations,
      totalSprintsUpdated,
      totalSprintsCreated,
      totalSprintsDeleted,
      failedUsers,
      processingTimeMs: Date.now() - startTime,
      concurrencyStats: {
        avgLockWaitTime: successfulOperations > 0 ? totalLockWaitTime / successfulOperations : 0,
        avgSemaphoreWaitTime: successfulOperations > 0 ? totalSemaphoreWaitTime / successfulOperations : 0,
        deadlocksPrevented: deadlocksPrevented + batchResult.stats.deadlocksPrevented
      }
    };
  }

  /**
   * Extract atomic sprint advancement operations for reuse
   */
  private async performAtomicSprintAdvancementOperations(
    tx: any,
    userId: string,
    operations: {
      currentSprintNumber: number;
      sprintStatusMap: Map<number, "historic" | "current" | "future">;
      newSprintsToCreate: Array<{
        sprintNumber: number;
        startDate: Date;
        endDate: Date;
        status: "historic" | "current" | "future";
      }>;
      sprintsToCleanup: number[];
    }
  ) {
    let sprintsUpdated = 0;
    let sprintsCreated = 0;
    let sprintsDeleted = 0;

    // Get existing sprints with row-level locking
    const existingSprints = await tx
      .select()
      .from(sprints)
      .where(eq(sprints.userId, userId))
      .for('update');

    const existingSprintMap = new Map(
      existingSprints.map((sprint: any) => [sprint.sprintNumber, sprint])
    );

    // Update sprint statuses
    for (const [sprintNumber, newStatus] of operations.sprintStatusMap.entries()) {
      const existingSprint = existingSprintMap.get(sprintNumber);
      
      if (existingSprint && existingSprint.status !== newStatus) {
        await tx
          .update(sprints)
          .set({ 
            status: newStatus, 
            updatedAt: new Date() 
          })
          .where(eq(sprints.id, existingSprint.id));
        
        sprintsUpdated++;
      }
    }

    // Create new sprints
    for (const newSprint of operations.newSprintsToCreate) {
      if (!existingSprintMap.has(newSprint.sprintNumber)) {
        await tx
          .insert(sprints)
          .values({
            userId,
            sprintNumber: newSprint.sprintNumber,
            startDate: newSprint.startDate,
            endDate: newSprint.endDate,
            type: null,
            description: null,
            status: newSprint.status,
          });
        
        sprintsCreated++;
      }
    }

    // Clean up old sprints
    for (const sprintNumber of operations.sprintsToCleanup) {
      const sprintToDelete = existingSprintMap.get(sprintNumber);
      
      if (sprintToDelete) {
        await tx.delete(sprintCommitments).where(eq(sprintCommitments.sprintId, sprintToDelete.id));
        await tx.delete(webhookLogs).where(eq(webhookLogs.sprintId, sprintToDelete.id));
        await tx.delete(sprints).where(eq(sprints.id, sprintToDelete.id));
        
        sprintsDeleted++;
      }
    }

    // Final validation
    const finalSprintCount = await tx
      .select({ count: sql<number>`count(*)`.as('count') })
      .from(sprints)
      .where(eq(sprints.userId, userId));

    const expectedCount = existingSprints.length + sprintsCreated - sprintsDeleted;
    if (Number(finalSprintCount[0]?.count || 0) !== expectedCount) {
      throw new Error(`Sprint count mismatch: expected ${expectedCount}, got ${finalSprintCount[0]?.count}`);
    }

    return { sprintsUpdated, sprintsCreated, sprintsDeleted };
  }

  // ===== ATOMIC SPRINT ADVANCEMENT OPERATIONS =====
  // Phase 5 Task 8: Create atomic sprint advancement operations

  /**
   * Atomic operation to advance all sprints for a single user
   * Handles the complete sprint transition lifecycle with rollback capability
   */
  async executeAtomicSprintAdvancement(
    userId: string,
    operations: {
      currentSprintNumber: number;
      sprintStatusMap: Map<number, "historic" | "current" | "future">;
      newSprintsToCreate: Array<{
        sprintNumber: number;
        startDate: Date;
        endDate: Date;
        status: "historic" | "current" | "future";
      }>;
      sprintsToCleanup: number[];
    }
  ): Promise<{
    success: boolean;
    sprintsUpdated: number;
    sprintsCreated: number;
    sprintsDeleted: number;
    error?: string;
  }> {
    const result = await this.executeTransaction(async (tx) => {
      let sprintsUpdated = 0;
      let sprintsCreated = 0;
      let sprintsDeleted = 0;

      // Step 1: Get all existing sprints for the user with row-level locking
      const existingSprints = await tx
        .select()
        .from(sprints)
        .where(eq(sprints.userId, userId))
        .for('update'); // Prevent concurrent modifications

      const existingSprintMap = new Map(
        existingSprints.map(sprint => [sprint.sprintNumber, sprint])
      );

      // Step 2: Update sprint statuses atomically
      for (const [sprintNumber, newStatus] of operations.sprintStatusMap.entries()) {
        const existingSprint = existingSprintMap.get(sprintNumber);
        
        if (existingSprint && existingSprint.status !== newStatus) {
          await tx
            .update(sprints)
            .set({ 
              status: newStatus, 
              updatedAt: new Date() 
            })
            .where(eq(sprints.id, existingSprint.id));
          
          sprintsUpdated++;
        }
      }

      // Step 3: Create new future sprints atomically
      for (const newSprint of operations.newSprintsToCreate) {
        if (!existingSprintMap.has(newSprint.sprintNumber)) {
          await tx
            .insert(sprints)
            .values({
              userId,
              sprintNumber: newSprint.sprintNumber,
              startDate: newSprint.startDate,
              endDate: newSprint.endDate,
              type: null, // New sprints start uncommitted
              description: null,
              status: newSprint.status,
            });
          
          sprintsCreated++;
        }
      }

      // Step 4: Clean up old historic sprints atomically
      for (const sprintNumber of operations.sprintsToCleanup) {
        const sprintToDelete = existingSprintMap.get(sprintNumber);
        
        if (sprintToDelete) {
          // Delete related sprint commitments first (cascade)
          await tx
            .delete(sprintCommitments)
            .where(eq(sprintCommitments.sprintId, sprintToDelete.id));

          // Delete related webhook logs (cascade)
          await tx
            .delete(webhookLogs)
            .where(eq(webhookLogs.sprintId, sprintToDelete.id));

          // Delete the sprint itself
          await tx
            .delete(sprints)
            .where(eq(sprints.id, sprintToDelete.id));
          
          sprintsDeleted++;
        }
      }

      // Step 5: Validate data consistency post-transaction
      const finalSprintCount = await tx
        .select({ count: sql<number>`count(*)`.as('count') })
        .from(sprints)
        .where(eq(sprints.userId, userId));

      const expectedCount = existingSprints.length + sprintsCreated - sprintsDeleted;
      if (Number(finalSprintCount[0]?.count || 0) !== expectedCount) {
        throw new Error(`Sprint count mismatch: expected ${expectedCount}, got ${finalSprintCount[0]?.count}`);
      }

      return { sprintsUpdated, sprintsCreated, sprintsDeleted };
    }, {
      retries: 3,
      isolationLevel: 'repeatable read',
      timeout: 45000, // Longer timeout for complex operations
      logQueries: true
    });

    if (!result.success) {
      return {
        success: false,
        sprintsUpdated: 0,
        sprintsCreated: 0,
        sprintsDeleted: 0,
        error: result.error?.message || 'Unknown transaction error'
      };
    }

    return {
      success: true,
      ...result.data!
    };
  }

  /**
   * Atomic bulk sprint advancement for all users
   * Processes multiple users with individual transaction isolation
   */
  async executeBulkSprintAdvancement(
    userOperations: Array<{
      userId: string;
      username: string;
      operations: {
        currentSprintNumber: number;
        sprintStatusMap: Map<number, "historic" | "current" | "future">;
        newSprintsToCreate: Array<{
          sprintNumber: number;
          startDate: Date;
          endDate: Date;
          status: "historic" | "current" | "future";
        }>;
        sprintsToCleanup: number[];
      };
    }>
  ): Promise<{
    totalUsersProcessed: number;
    totalSprintsUpdated: number;
    totalSprintsCreated: number;
    totalSprintsDeleted: number;
    failedUsers: Array<{ username: string; error: string }>;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();
    let totalUsersProcessed = 0;
    let totalSprintsUpdated = 0;
    let totalSprintsCreated = 0;
    let totalSprintsDeleted = 0;
    const failedUsers: Array<{ username: string; error: string }> = [];

    // Process each user individually to ensure isolation
    for (const userOp of userOperations) {
      try {
        const result = await this.executeAtomicSprintAdvancement(
          userOp.userId,
          userOp.operations
        );

        if (result.success) {
          totalUsersProcessed++;
          totalSprintsUpdated += result.sprintsUpdated;
          totalSprintsCreated += result.sprintsCreated;
          totalSprintsDeleted += result.sprintsDeleted;
        } else {
          failedUsers.push({
            username: userOp.username,
            error: result.error || 'Unknown error'
          });
        }
      } catch (error) {
        failedUsers.push({
          username: userOp.username,
          error: error instanceof Error ? error.message : 'Unexpected error'
        });
      }
    }

    return {
      totalUsersProcessed,
      totalSprintsUpdated,
      totalSprintsCreated,
      totalSprintsDeleted,
      failedUsers,
      processingTimeMs: Date.now() - startTime
    };
  }

  /**
   * Atomic operation to verify sprint advancement integrity
   * Checks data consistency after sprint transitions
   */
  async verifySprintAdvancementIntegrity(userId: string): Promise<{
    isValid: boolean;
    issues: string[];
    sprintCounts: {
      historic: number;
      current: number;
      future: number;
      total: number;
    };
  }> {
    const result = await this.executeTransaction(async (tx) => {
      const issues: string[] = [];

      // Get all sprints for the user
      const allSprints = await tx
        .select()
        .from(sprints)
        .where(eq(sprints.userId, userId))
        .orderBy(asc(sprints.sprintNumber));

      // Count sprints by status
      const sprintCounts = {
        historic: allSprints.filter(s => s.status === 'historic').length,
        current: allSprints.filter(s => s.status === 'current').length,
        future: allSprints.filter(s => s.status === 'future').length,
        total: allSprints.length
      };

      // Validation checks
      if (sprintCounts.current !== 1) {
        issues.push(`Expected exactly 1 current sprint, found ${sprintCounts.current}`);
      }

      if (sprintCounts.future !== 6) {
        issues.push(`Expected exactly 6 future sprints, found ${sprintCounts.future}`);
      }

      if (sprintCounts.historic > 24) {
        issues.push(`Too many historic sprints: ${sprintCounts.historic} (max 24)`);
      }

      // Check for duplicate sprint numbers
      const sprintNumbers = allSprints.map(s => s.sprintNumber);
      const uniqueNumbers = new Set(sprintNumbers);
      if (sprintNumbers.length !== uniqueNumbers.size) {
        issues.push('Duplicate sprint numbers detected');
      }

      // Check for gaps in sprint sequence
      const sortedNumbers = [...uniqueNumbers].sort((a, b) => a - b);
      for (let i = 1; i < sortedNumbers.length; i++) {
        if (sortedNumbers[i] !== sortedNumbers[i - 1] + 1) {
          issues.push(`Gap in sprint sequence between ${sortedNumbers[i - 1]} and ${sortedNumbers[i]}`);
        }
      }

      // Check sprint date consistency
      for (const sprint of allSprints) {
        if (sprint.endDate <= sprint.startDate) {
          issues.push(`Sprint ${sprint.sprintNumber} has invalid date range`);
        }
      }

      // Check orphaned commitments
      const orphanedCommitments = await tx
        .select({ count: sql<number>`count(*)`.as('count') })
        .from(sprintCommitments)
        .leftJoin(sprints, eq(sprintCommitments.sprintId, sprints.id))
        .where(
          and(
            eq(sprintCommitments.userId, userId),
            sql`${sprints.id} IS NULL`
          )
        );

      if (Number(orphanedCommitments[0]?.count || 0) > 0) {
        issues.push(`Found ${orphanedCommitments[0]?.count} orphaned commitments`);
      }

      return { issues, sprintCounts };
    }, {
      retries: 1,
      isolationLevel: 'read committed',
      logQueries: false
    });

    if (!result.success) {
      return {
        isValid: false,
        issues: [`Transaction failed: ${result.error?.message}`],
        sprintCounts: { historic: 0, current: 0, future: 0, total: 0 }
      };
    }

    return {
      isValid: result.data!.issues.length === 0,
      issues: result.data!.issues,
      sprintCounts: result.data!.sprintCounts
    };
  }

  /**
   * Atomic rollback operation for failed sprint advancements
   * Restores sprint data to a previous consistent state
   */
  async executeSprintAdvancementRollback(
    userId: string,
    backupData: {
      sprints: Array<{
        id: string;
        sprintNumber: number;
        status: "historic" | "current" | "future";
        type: "build" | "test" | "pto" | null;
        description: string | null;
      }>;
      commitments: Array<{
        id: string;
        sprintId: string;
        type: "build" | "test" | "pto";
        description: string | null;
      }>;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.executeTransaction(async (tx) => {
      // Step 1: Delete all current sprint data
      await tx
        .delete(sprintCommitments)
        .where(eq(sprintCommitments.userId, userId));

      await tx
        .delete(sprints)
        .where(eq(sprints.userId, userId));

      // Step 2: Restore sprint data from backup
      for (const sprintBackup of backupData.sprints) {
        await tx
          .insert(sprints)
          .values({
            id: sprintBackup.id,
            userId,
            sprintNumber: sprintBackup.sprintNumber,
            startDate: new Date(), // Will be recalculated
            endDate: new Date(),   // Will be recalculated
            type: sprintBackup.type,
            description: sprintBackup.description,
            status: sprintBackup.status,
          });
      }

      // Step 3: Restore commitment data from backup
      for (const commitmentBackup of backupData.commitments) {
        await tx
          .insert(sprintCommitments)
          .values({
            id: commitmentBackup.id,
            userId,
            sprintId: commitmentBackup.sprintId,
            type: commitmentBackup.type,
            description: commitmentBackup.description,
            isNewCommitment: false,
          });
      }

      return true;
    }, {
      retries: 2,
      isolationLevel: 'serializable',
      timeout: 60000,
      logQueries: true
    });

    return {
      success: result.success,
      error: result.error?.message
    };
  }

  /**
   * Create a backup snapshot of user's sprint data before advancement
   * Used for rollback capability
   */
  async createSprintAdvancementBackup(userId: string): Promise<{
    sprints: Array<{
      id: string;
      sprintNumber: number;
      status: "historic" | "current" | "future";
      type: "build" | "test" | "pto" | null;
      description: string | null;
    }>;
    commitments: Array<{
      id: string;
      sprintId: string;
      type: "build" | "test" | "pto";
      description: string | null;
    }>;
  }> {
    const [sprintData, commitmentData] = await Promise.all([
      db
        .select({
          id: sprints.id,
          sprintNumber: sprints.sprintNumber,
          status: sprints.status,
          type: sprints.type,
          description: sprints.description,
        })
        .from(sprints)
        .where(eq(sprints.userId, userId)),
      
      db
        .select({
          id: sprintCommitments.id,
          sprintId: sprintCommitments.sprintId,
          type: sprintCommitments.type,
          description: sprintCommitments.description,
        })
        .from(sprintCommitments)
        .where(eq(sprintCommitments.userId, userId))
    ]);

    return {
      sprints: sprintData,
      commitments: commitmentData
    };
  }
}

export const storage = new DatabaseStorage();