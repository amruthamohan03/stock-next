# Stock Management — Next.js + PostgreSQL

A Next.js (App Router) + PostgreSQL rewrite of the original PHP/MVC college
stock & inventory system (`amruthamohan03/stock`). This is the **working
foundation + core modules** pass: full schema, real-data migration path, auth,
RBAC, and the most-used modules. See [MIGRATION_NOTES.md](./MIGRATION_NOTES.md)
for what's ported vs. pending and how the two apps map to each other.

## Stack

| Concern      | Choice                                    |
| ------------ | ----------------------------------------- |
| Framework    | Next.js 15 (App Router, React 19, TS)     |
| Database     | PostgreSQL                                |
| ORM          | Drizzle ORM + drizzle-kit                 |
| Auth         | bcrypt password check + JWT session cookie (jose) |
| Styling      | Tailwind CSS v4 + lightweight shadcn-style UI |

## Prerequisites

- Node.js 18.18+ (20+ recommended)
- A PostgreSQL 14+ database

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   - set DATABASE_URL to your Postgres instance
#   - set AUTH_SECRET to a long random string (>= 32 chars)

# 3. Create the schema in your database
npm run db:push          # or: npm run db:generate && npm run db:migrate

# 4a. Quick start with a minimal seed (admin user + menu + a few masters)
npm run db:seed

#     ...OR...

# 4b. Bring your REAL data over from the MySQL dump
#     Put your dump (e.g. stock_db.sql) in the project root, then:
npm run db:convert -- ./stock_db.sql   # -> writes pg_seed.sql
npm run db:load                        # loads pg_seed.sql into Postgres
npm run db:seed                        # ensures menu/admin exist (idempotent)

# 5. Run
npm run dev
# open http://localhost:3000  →  redirected to /login
```

**Default login:** `supadmin` / _your existing production password_.
The original bcrypt hash is preserved, so current credentials keep working.
Don't know it? Set a fresh one: `AUTH_RESET_PASSWORD=newpass npm run db:seed`.

## Bringing your real data over

The original database is MariaDB. `scripts/mysql-to-pg.mjs` converts the dump's
`INSERT` statements into a PostgreSQL-loadable, data-only file:

- keeps only `INSERT INTO … ;` statements (multi-line aware)
- backtick identifiers → double-quoted identifiers
- MySQL backslash escapes → PostgreSQL standard-conforming strings
- `'0000-00-00'` → `NULL`
- wraps the load in a transaction with FK/trigger checks disabled
- resets identity sequences afterward so new inserts don't collide

Because the Drizzle schema mirrors the original table and column names exactly,
the converted `INSERT`s drop straight in.

## Project structure

```
src/
  db/
    schema.ts        # Drizzle schema — every table from the dump
    index.ts         # postgres.js + drizzle client
  lib/
    session.ts       # JWT session cookie helpers
    password.ts      # bcrypt verify (handles PHP's $2y$ hashes)
    auth-actions.ts  # login / logout server actions
    rbac.ts          # role → menu tree + permission checks
    masters-config.ts# generic CRUD whitelist per master
    menu-map.ts      # legacy PHP url → Next route
  components/        # sidebar, topbar, CRUD table, UI primitives
  app/
    login/           # login page + form
    (dashboard)/     # protected shell: dashboard, item, make, model,
                     #   department, provider, unit, indent, stock, …
    api/masters/[key]# generic REST CRUD for master tables
  middleware.ts      # session gate for all non-public routes
scripts/
  mysql-to-pg.mjs    # MySQL dump → Postgres data file
  load-sql.ts        # load a .sql file via postgres.js (no psql needed)
  seed.ts            # minimal idempotent seed
```

## Available scripts

| Script                | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `npm run dev`         | Start the dev server                           |
| `npm run build`       | Production build                               |
| `npm run typecheck`   | `tsc --noEmit`                                 |
| `npm run db:push`     | Sync Drizzle schema to the database            |
| `npm run db:generate` | Generate SQL migrations from the schema        |
| `npm run db:migrate`  | Apply generated migrations                     |
| `npm run db:studio`   | Open Drizzle Studio                            |
| `npm run db:convert`  | Convert a MySQL dump to `pg_seed.sql`          |
| `npm run db:load`     | Load `pg_seed.sql` into Postgres               |
| `npm run db:seed`     | Minimal idempotent seed                        |
