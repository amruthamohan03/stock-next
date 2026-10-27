ALTER TABLE "stock_transaction_t" ADD COLUMN "source_type" varchar(20);--> statement-breakpoint
ALTER TABLE "stock_transaction_t" ADD COLUMN "transferred_from_department_id" integer;