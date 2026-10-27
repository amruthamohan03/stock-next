ALTER TABLE "indent_item_t" ADD COLUMN "stock_book_master_id" integer;--> statement-breakpoint
ALTER TABLE "indent_master_t" ADD COLUMN "no_stock_entry" varchar(1) DEFAULT 'N';--> statement-breakpoint
ALTER TABLE "stock_transaction_t" ADD COLUMN "no_indent_entry" varchar(1) DEFAULT 'N';