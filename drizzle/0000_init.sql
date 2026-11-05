CREATE TABLE "file_chunks" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"file_id" varchar(36) NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"page_start" integer,
	"page_end" integer,
	"section_path" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding" vector(768) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_contents" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"file_id" varchar(36) NOT NULL,
	"content_json" jsonb NOT NULL,
	"markdown" text NOT NULL,
	"plain_text" text NOT NULL,
	"extraction_version" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"storage_path" text NOT NULL,
	"bucket_name" varchar(255) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"file_size" bigint,
	"status" varchar(30) DEFAULT 'uploaded' NOT NULL,
	"processing_status" varchar(30) DEFAULT 'pending' NOT NULL,
	"page_count" integer,
	"processed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"session_id" varchar(36) NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"parts" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_contents" ADD CONSTRAINT "file_contents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_chunks_file_id_idx" ON "file_chunks" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_chunks_file_id_chunk_index_uidx" ON "file_chunks" USING btree ("file_id","chunk_index");--> statement-breakpoint
CREATE UNIQUE INDEX "file_contents_file_id_uidx" ON "file_contents" USING btree ("file_id");