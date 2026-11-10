ALTER TABLE "stock_book_move_t" ALTER COLUMN "to_stock_book_master_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_book_move_t" ADD COLUMN "action" varchar(10) DEFAULT 'MOVE' NOT NULL;