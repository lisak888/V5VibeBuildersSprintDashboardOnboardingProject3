import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Index for username-based authentication queries (already has unique constraint but explicit index for clarity)
  usernameIdx: index("idx_users_username").on(table.username),
}));

export const sprints = pgTable("sprints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sprintNumber: integer("sprint_number").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  type: text("type").$type<"build" | "test" | "pto" | null>(),
  description: text("description"),
  status: text("status").$type<"historic" | "current" | "future">().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Composite index for dashboard queries - user + status filtering
  userStatusIdx: index("idx_sprints_user_status").on(table.userId, table.status),
  // Index for sprint number queries within user context
  userSprintNumberIdx: index("idx_sprints_user_sprint_number").on(table.userId, table.sprintNumber),
  // Index for date-based queries and transitions
  startDateIdx: index("idx_sprints_start_date").on(table.startDate),
  // Index for status transitions
  statusIdx: index("idx_sprints_status").on(table.status),
}));

export const sprintCommitments = pgTable("sprint_commitments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sprintId: varchar("sprint_id").notNull().references(() => sprints.id, { onDelete: "cascade" }),
  type: text("type").$type<"build" | "test" | "pto">().notNull(),
  description: text("description"),
  isNewCommitment: boolean("is_new_commitment").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Index for user-specific commitment queries
  userIdIdx: index("idx_sprint_commitments_user").on(table.userId),
  // Index for sprint-specific commitment lookups
  sprintIdIdx: index("idx_sprint_commitments_sprint").on(table.sprintId),
  // Composite index for user + sprint queries
  userSprintIdx: index("idx_sprint_commitments_user_sprint").on(table.userId, table.sprintId),
  // Index for webhook processing - finding new commitments
  newCommitmentIdx: index("idx_sprint_commitments_new").on(table.isNewCommitment),
  // Index for type-based filtering and validation
  typeIdx: index("idx_sprint_commitments_type").on(table.type),
}));

export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sprintId: varchar("sprint_id").references(() => sprints.id, { onDelete: "cascade" }),
  webhookType: text("webhook_type").$type<"new_commitment" | "dashboard_completion">().notNull(),
  payload: text("payload").notNull(), // JSON string
  status: text("status").$type<"success" | "failed">().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Index for user-specific webhook log queries
  userIdIdx: index("idx_webhook_logs_user").on(table.userId),
  // Composite index for webhook type filtering by user
  userTypeIdx: index("idx_webhook_logs_user_type").on(table.userId, table.webhookType),
  // Index for monitoring webhook delivery status
  statusIdx: index("idx_webhook_logs_status").on(table.status),
  // Index for chronological webhook log ordering
  createdAtIdx: index("idx_webhook_logs_created_at").on(table.createdAt),
  // Index for sprint-specific webhook tracking
  sprintIdIdx: index("idx_webhook_logs_sprint").on(table.sprintId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sprints: many(sprints),
  sprintCommitments: many(sprintCommitments),
  webhookLogs: many(webhookLogs),
}));

export const sprintsRelations = relations(sprints, ({ one, many }) => ({
  user: one(users, {
    fields: [sprints.userId],
    references: [users.id],
  }),
  commitments: many(sprintCommitments),
  webhookLogs: many(webhookLogs),
}));

export const sprintCommitmentsRelations = relations(sprintCommitments, ({ one }) => ({
  user: one(users, {
    fields: [sprintCommitments.userId],
    references: [users.id],
  }),
  sprint: one(sprints, {
    fields: [sprintCommitments.sprintId],
    references: [sprints.id],
  }),
}));

export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
  user: one(users, {
    fields: [webhookLogs.userId],
    references: [users.id],
  }),
  sprint: one(sprints, {
    fields: [webhookLogs.sprintId],
    references: [sprints.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertSprintSchema = createInsertSchema(sprints).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSprintCommitmentSchema = createInsertSchema(sprintCommitments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertSprint = z.infer<typeof insertSprintSchema>;
export type Sprint = typeof sprints.$inferSelect;

export type InsertSprintCommitment = z.infer<typeof insertSprintCommitmentSchema>;
export type SprintCommitment = typeof sprintCommitments.$inferSelect;

export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;
export type WebhookLog = typeof webhookLogs.$inferSelect;

// API schemas
export const updateSprintCommitmentsSchema = z.object({
  commitments: z.array(z.object({
    sprintId: z.string(),
    type: z.enum(["build", "test", "pto"]).optional(),
    description: z.string().optional(),
  })),
});

export type UpdateSprintCommitmentsRequest = z.infer<typeof updateSprintCommitmentsSchema>;
