CREATE TABLE "companies" (
	"ticker" varchar(10) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"exchange" varchar(20) NOT NULL,
	"industry" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_facts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"report_id" varchar(36) NOT NULL,
	"statement" varchar(30) NOT NULL,
	"metric_code" varchar(64) NOT NULL,
	"source_label" text,
	"value" numeric(24, 4) NOT NULL,
	"unit" varchar(20) DEFAULT 'million_vnd' NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_page" integer,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"ticker" varchar(10) NOT NULL,
	"fiscal_year" integer NOT NULL,
	"fiscal_quarter" integer NOT NULL,
	"report_type" varchar(20) DEFAULT 'consolidated' NOT NULL,
	"audit_status" varchar(20) DEFAULT 'unaudited' NOT NULL,
	"published_at" timestamp with time zone,
	"file_id" varchar(36),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_fiscal_quarter_check" CHECK ("reports"."fiscal_quarter" between 0 and 4)
);
--> statement-breakpoint
ALTER TABLE "financial_facts" ADD CONSTRAINT "financial_facts_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_ticker_companies_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."companies"("ticker") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_facts_report_metric_source_uidx" ON "financial_facts" USING btree ("report_id","metric_code","source");--> statement-breakpoint
CREATE INDEX "financial_facts_metric_code_idx" ON "financial_facts" USING btree ("metric_code");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_period_uidx" ON "reports" USING btree ("ticker","fiscal_year","fiscal_quarter","report_type");