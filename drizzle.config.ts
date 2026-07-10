import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load .env.local then .env
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/stock_db",
  },
  verbose: true,
  strict: true,
});
