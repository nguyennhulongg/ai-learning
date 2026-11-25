ALTER TABLE "files" ADD COLUMN "content_hash" varchar(64);--> statement-breakpoint
CREATE INDEX "files_content_hash_idx" ON "files" USING btree ("content_hash");