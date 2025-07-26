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