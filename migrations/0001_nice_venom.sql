CREATE INDEX "idx_sprint_commitments_user" ON "sprint_commitments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sprint_commitments_sprint" ON "sprint_commitments" USING btree ("sprint_id");--> statement-breakpoint
CREATE INDEX "idx_sprint_commitments_user_sprint" ON "sprint_commitments" USING btree ("user_id","sprint_id");--> statement-breakpoint
CREATE INDEX "idx_sprint_commitments_new" ON "sprint_commitments" USING btree ("is_new_commitment");--> statement-breakpoint
CREATE INDEX "idx_sprint_commitments_type" ON "sprint_commitments" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_sprints_user_status" ON "sprints" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_sprints_user_sprint_number" ON "sprints" USING btree ("user_id","sprint_number");--> statement-breakpoint
CREATE INDEX "idx_sprints_start_date" ON "sprints" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_sprints_status" ON "sprints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_user" ON "webhook_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_user_type" ON "webhook_logs" USING btree ("user_id","webhook_type");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_status" ON "webhook_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_created_at" ON "webhook_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_sprint" ON "webhook_logs" USING btree ("sprint_id");