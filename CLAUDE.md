# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js 15 (App Router, React 19) + PostgreSQL rewrite of an existing PHP/MVC
college stock & inventory system (`amruthamohan03/stock`). It is a **partial
port**: schema and data migration are complete, but only auth, RBAC, the
dashboard, and a handful of master/read modules are implemented. See
[MIGRATION_NOTES.md](./MIGRATION_NOTES.md) for the authoritative per-module
status table before assuming a feature exists — several sidebar entries are
"coming soon" placeholders, not working pages.

## Commands

```bash
npm run dev          # dev server → http://localhost:3000 (redirects to /login)
npm run build        # production build
npm run start        # serve the production build
npm run typecheck    # tsc --noEmit  ← primary correctness gate
npm run lint         # next lint (note: no ESLint config shipped; ignored during builds)

# Database (Drizzle + drizzle-kit; needs DATABASE_URL)
npm run db:push      # sync src/db/schema.ts to the DB (dev workflow of choice)
npm run db:generate  # emit SQL migrations from the schema
npm run db:migrate   # apply generated migrations
npm run db:studio    # Drizzle Studio
npm run db:seed      # minimal idempotent seed (admin user + menu + masters)

# Real-data migration from the original MariaDB dump
npm run db:convert -- ./stock_db.sql   # MySQL dump → pg_seed.sql
npm run db:load                        # load pg_seed.sql via postgres.js (no psql needed)
```

There is **no test runner** — `npm run typecheck` is the main verification step.
`next.config.ts` sets `ignoreDuringBuilds` for ESLint, so lint never blocks a
build; run `typecheck` to catch real errors.

## Environment

Copy `.env.example` → `.env`. Required: `DATABASE_URL` (Postgres) and
`AUTH_SECRET` (≥16 chars enforced in code, ≥32 recommended — it signs the
session JWT). `drizzle.config.ts` loads `.env.local` then `.env`.

Default login is `supadmin` with the original production password (bcrypt hashes
carry over). Reset with `AUTH_RESET_PASSWORD=newpass npm run db:seed`.

## Architecture

**Data layer.** `src/db/schema.ts` mirrors all ~35 tables from the MariaDB dump
with **identical table and column names** — this is load-bearing, because the
converter (`scripts/mysql-to-pg.mjs`) drops the original `INSERT`s in unchanged.
Do not rename columns to be more idiomatic. Foreign keys are **not enforced at
the DB level** (the original used MyISAM); relationships are resolved in queries
with explicit Drizzle joins. `src/db/index.ts` exports the `db` client
(postgres.js + drizzle). Table variables use a `…T` suffix (e.g. `usersT`,
`makeT`, `menuMasterT`).

**Auth.** Stateless JWT session cookie (`jose`), not server sessions.
`src/lib/session.ts` owns the cookie (`stock_session`, 8h, httpOnly) and the
`getSession()` helper used by server components, route handlers, and actions.
`src/lib/auth-actions.ts` has the `loginAction`/`logoutAction` server actions;
`src/lib/password.ts` verifies bcrypt, normalizing PHP `$2y$` hashes to `$2b$`.
`src/middleware.ts` gates every route except `PUBLIC_PATHS`, redirecting to
`/login?next=…` when the cookie is missing/invalid.

**RBAC & menu.** The sidebar and permissions are data-driven from
`menu_master_t` + `role_menu_mapping_t`, exactly like the PHP `MenuModel`.
`src/lib/rbac.ts` — `getMenuForRole(roleId)` builds the nested menu tree
(top level = `menu_level === 0`, children nest under `menu_id`) and prunes
branches the role can't see; `hasPermission(roleId, urls, action)` checks a
specific capability. **`role_id === 1` (Super Admin) bypasses all checks and
sees every active menu** — this shortcut is repeated in several places, keep it
consistent. `src/lib/menu-map.ts` maps legacy PHP URLs (stored in the DB) to
Next routes and tracks which routes are actually `IMPLEMENTED`; unported menu
items route through the `(dashboard)/[...slug]` catch-all "coming soon" page.

**Routing.** `src/app/(dashboard)/layout.tsx` is the protected shell: it calls
`getSession()`, builds the menu, and renders the sidebar + topbar around each
page. Pages are async server components that query `db` directly and render
client components.

**The generic CRUD pattern (important — most masters use it).** Adding a master
is three steps, not a new controller:
1. The table already exists in `src/db/schema.ts`.
2. Register a whitelist entry in `src/lib/masters-config.ts` (`MASTERS[key]`:
   `table`, `writable` columns, optional `numeric` columns).
3. Create `src/app/(dashboard)/<name>/page.tsx` that fetches rows (filter
   `display = 'Y'`) and renders `<CrudTable apiKey="<key>" columns fields rows />`
   — see `make/page.tsx` for the minimal template.

One route handler, `src/app/api/masters/[key]/route.ts`, serves POST/PUT/DELETE
for every master. It looks up `MASTERS[key]`, whitelists writable fields, coerces
`numeric` fields, auto-fills `created_by`/`updated_by`/`updated_at` from the
session when those columns exist, and **soft-deletes** (sets `display = 'N'`)
when a `display` column exists — hard delete only when it doesn't. Lists filter
on `display = 'Y'` so soft-deleted rows disappear. Never write a column not in
the `writable` whitelist — the route silently ignores it.

## UI conventions (required for every list & form)

These are hard rules — new pages must follow them, don't hand-roll a bare table
or a native `<select>`:

- **Every list/table must have a search box and pagination.** Don't render a
  raw `<table>` on a page. Use one of two shared components:
  - Editable master lists → `CrudTable` (`src/components/crud-table.tsx`) — has
    search, pagination (`PAGE_SIZE = 10`), add/edit/delete built in.
  - Read-only lists → `DataTable` (`src/components/data-table.tsx`) — generic
    columns with optional `render`/`value`, search across all columns, and
    pagination. See `indent/indent-table.tsx` and `stock/stock-table.tsx` for
    the pattern.
- **Every dropdown must be searchable.** Use `SearchableSelect`
  (`src/components/ui/searchable-select.tsx`), never the native `<select>`.
  `CrudTable` already renders `type: "select"` fields through it.
- **`DataTable` columns use `render`/`value` functions**, which can't cross the
  server→client boundary. So a read-only list page is split: the `page.tsx`
  server component fetches plain (serializable) rows and passes them to a
  `"use client"` wrapper (e.g. `IndentTable`) that defines the columns and
  renders `<DataTable>`. Follow that split; don't try to pass column render
  functions from a server component.
- Search + pagination reset: changing the search query resets to page 1 (both
  components already do this) — preserve that when editing them.

## Theming & common styling (required)

The app is **dark by default with a light toggle**, driven entirely by semantic
CSS-variable tokens defined in `src/app/globals.css`. Style with the tokens, not
hardcoded palette colours — a page that uses raw `bg-white` / `text-slate-700`
will not theme correctly.

- **Use the semantic token utilities, never hardcode surface/text/border
  colours.** The tokens (defined in `@theme` → resolve to `--*` vars that swap
  per theme):
  - Surfaces: `bg-surface` (page), `bg-card` (panels), `bg-elevated` (inputs,
    hovers, table headers).
  - Text: `text-fg` (primary), `text-muted` (secondary), `text-faint`
    (tertiary/placeholder).
  - Borders: `border-line`. Accent: `bg-accent` / `text-accent` /
    `bg-accent-soft` / `text-accent-fg` (active nav, selected option, row hover).
  - Brand scale `brand-50…700` is fixed across themes; for tints that must work
    on dark **and** light use an opacity form (`bg-emerald-500/15
    text-emerald-500 ring-emerald-500/25`), not the `-50/-700` light shades.
  - Vibrant gradient helpers for stat tiles: `grad-blue/green/violet/amber/rose/cyan`.
- **Theme switching**: default dark is set by the no-flash inline script in
  `src/app/layout.tsx` (`data-theme` on `<html>`); the topbar `ThemeToggle`
  (`src/components/theme-toggle.tsx`) flips it and persists to `localStorage`.
  Don't add a second theme mechanism.
- **Restyle the shared component, not each page.** Card, Button, Input, Modal,
  Pagination, SearchableSelect, DataTable, CrudTable, sidebar and topbar all use
  tokens, so most pages inherit the theme for free. Fix look-and-feel there once
  rather than per page.

## Code quality (required)

- **No redundant code.** Reuse existing shared components, helpers and route
  handlers before writing new ones (the generic masters route, `CrudTable`,
  `buttonClasses()`, `getIndentOptions()`, `StatusBadge` are examples). If the
  same query, markup or class list appears twice, extract it. Duplicated colour
  strings are a smell — use a token or a shared helper.
- **Optimised code.** Fetch in parallel (`Promise.all`) in server components;
  don't N+1 queries in a loop when a join or aggregate does it. Compute derived
  values in one pass. Keep `render`/`value` and other hot functions cheap.
- **Typecheck is the gate.** Run `npm run typecheck` after changes (there is no
  test runner). Keep imports and variables used — no dead code.

## Conventions & gotchas

- **Preserve original DB names.** Column/table naming matches the PHP app so the
  data migration stays lossless. `licenses_t` and `locals_t` belong to an
  unrelated app that shared the DB — kept for import fidelity, not surfaced in UI.
- **Soft delete over hard delete** for masters; this is deliberate (history
  preservation) and baked into the generic route.
- **`role_id = 1` is the god-mode escape hatch** across auth/RBAC/menu code.
- Drizzle `enum('Y','N')` columns are modeled as `varchar` with the `Y`/`N`
  values preserved; `tinyint(1)` flags are `integer` 0/1.
- Check MIGRATION_NOTES before extending a module — "Stock entry/transfer",
  "Day Book", reports, and user/role/menu admin are **not yet ported**.
