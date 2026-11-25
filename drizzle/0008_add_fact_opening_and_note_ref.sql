DROP INDEX "financial_facts_report_metric_source_uidx";--> statement-breakpoint
ALTER TABLE "financial_facts" ADD COLUMN "is_opening" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_facts" ADD COLUMN "note_ref" varchar(20);--> statement-breakpoint
CREATE UNIQUE INDEX "financial_facts_report_metric_source_uidx" ON "financial_facts" USING btree ("report_id","metric_code","source","is_opening");