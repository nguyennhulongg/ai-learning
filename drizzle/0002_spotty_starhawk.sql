ALTER TABLE "messages" ALTER COLUMN "id" SET DATA TYPE varchar(36);--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "session_id" SET DATA TYPE varchar(36);--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "id" SET DATA TYPE varchar(36);--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "parts" text NOT NULL;