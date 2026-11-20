CREATE TABLE IF NOT EXISTS "income_tax_year_t" (
	"financial_year" varchar(10) PRIMARY KEY NOT NULL,
	"locked" integer DEFAULT 1 NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now()
);
