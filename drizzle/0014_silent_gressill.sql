ALTER TABLE "stock_book_move_t" ADD COLUMN "to_indent_id" integer;--> statement-breakpoint
ALTER TABLE "stock_book_move_t" ADD COLUMN "created_indent" varchar(1) DEFAULT 'N' NOT NULL;