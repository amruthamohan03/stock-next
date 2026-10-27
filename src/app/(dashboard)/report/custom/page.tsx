import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ChartPie, ListTree } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import FilterBar, { type FilterField } from "../_components/filter-bar";
import { ReportTabs, ReportHeader, StatCard } from "../_components/report-ui";
import {
  getReportOptions,
  resolveInstDept,
  intListParam,
  codeListParam,
  pickParam,
  DIRECTIONS,
  dateParam,
  one,
  periodLabel,
  type SP,
} from "../_components/report-data";

const num = (v: unknown) => Number(v ?? 0);

const ITEM_STATUSES = ["WORKING", "NOT_WORKING", "DAMAGED", "CONDEMNED", "DELETED"] as const;

/**
 * Sort keys per tab. The key only ever selects a fragment from these maps —
 * it is never interpolated — so a hand-edited `?sort=` cannot reach the SQL.
 */
const SUMMARY_SORTS = {
  group: { label: "Group name", col: sql`group_name` },
  items: { label: "Items", col: sql`COUNT(DISTINCT item_id)` },
  indented: { label: "Indented", col: sql`COALESCE(SUM(indented), 0)` },
  received: { label: "Received", col: sql`COALESCE(SUM(received), 0)` },
  balance: {
    label: "Balance",
    col: sql`(COALESCE(SUM(received),0) - COALESCE(SUM(issued),0) - COALESCE(SUM(transferred),0) - COALESCE(SUM(written_off),0))`,
  },
} as const;

const DETAIL_SORTS = {
  group: { label: "Group / item", col: sql`group_name` },
  indent_date: { label: "Indent date", col: sql`indent_date` },
  indent_no: { label: "Indent no", col: sql`lpad(indent_no, 12, '0')` },
  item: { label: "Item name", col: sql`item_name` },
  indented: { label: "Indented", col: sql`indented` },
  received: { label: "Received", col: sql`receipt_qty` },
} as const;

/** `col IN (a, b, …)` with every value parameterised. */
const inList = (col: ReturnType<typeof sql>, values: (string | number)[]) =>
  sql`${col} IN (${sql.join(values.map((v) => sql`${v}`), sql`, `)})`;

export default async function CustomReportPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const tab = one(sp, "tab") === "detailed" ? "detailed" : "summary";

  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to");
  // Every select on this report takes several values; each param is a
  // comma-separated list and becomes an IN (…) condition.
  const instIds = intListParam(sp, "institution_id");
  const deptIds = intListParam(sp, "dept_id");
  const indentBookIds = intListParam(sp, "indent_book");
  const stockBookIds = intListParam(sp, "stock_book");
  const categoryIds = intListParam(sp, "category");
  const itemStatuses = codeListParam(sp, "item_status", ITEM_STATUSES);
  const excludeDeleted = one(sp, "exclude_deleted") === "1";

  // The sort list follows the tab, because the two tabs have different columns.
  const sortKeys = (tab === "summary" ? Object.keys(SUMMARY_SORTS) : Object.keys(DETAIL_SORTS)) as
    ("group" | "items" | "indented" | "received" | "balance" | "indent_date" | "indent_no" | "item")[];
  const sortKey = pickParam(sp, "sort", sortKeys, sortKeys[0]);
  const dir = pickParam(sp, "dir", ["asc", "desc"] as const, "asc");
  const sortCol =
    tab === "summary"
      ? SUMMARY_SORTS[sortKey as keyof typeof SUMMARY_SORTS].col
      : DETAIL_SORTS[sortKey as keyof typeof DETAIL_SORTS].col;
  const orderBy = dir === "desc" ? sql`${sortCol} DESC` : sql`${sortCol} ASC`;

  const [
    { institutions, departments, indentBooks, stockBooks, itemCategories },
    { institution, department },
  ] = await Promise.all([getReportOptions(), resolveInstDept(sp)]);

  const fields: FilterField[] = [
    { key: "institution_id", label: "Institution", type: "select", multi: true, options: institutions, placeholder: "All Institutions" },
    { key: "dept_id", label: "Department", type: "select", multi: true, options: departments, dependsOn: "institution_id", placeholder: "All Departments" },
    { key: "indent_book", label: "Indent Book", type: "select", multi: true, options: indentBooks, placeholder: "All Indent Books" },
    { key: "stock_book", label: "Stock Book", type: "select", multi: true, options: stockBooks, placeholder: "All Stock Books" },
    { key: "category", label: "Item Category", type: "select", multi: true, options: itemCategories, placeholder: "All Categories" },
    { key: "from", label: "From Date", type: "date" },
    { key: "to", label: "To Date", type: "date" },
    {
      key: "item_status",
      label: "Item Status",
      type: "select",
      multi: true,
      placeholder: "All Statuses",
      options: [
        { value: "WORKING", label: "Working" },
        { value: "NOT_WORKING", label: "Not working" },
        { value: "DAMAGED", label: "Damaged" },
        { value: "CONDEMNED", label: "Condemned" },
        { value: "DELETED", label: "Deleted" },
      ],
    },
    {
      key: "sort",
      label: "Sort By",
      type: "select",
      options: Object.entries(tab === "summary" ? SUMMARY_SORTS : DETAIL_SORTS).map(
        ([value, v]) => ({ value, label: v.label })
      ),
    },
    { key: "dir", label: "Order", type: "select", options: [...DIRECTIONS] },
    { key: "exclude_deleted", label: "Exclude deleted items", type: "toggle" },
  ];

  // Shared WHERE fragments (parameterized → injection-safe).
  const cond = [sql`st.display='Y'`];
  if (from && to) cond.push(sql`st.transaction_date BETWEEN ${from} AND ${to}`);
  if (instIds.length) cond.push(inList(sql`st.institution_id`, instIds));
  if (deptIds.length) cond.push(inList(sql`st.department_id`, deptIds));
  // An indent's book_no is the id of a row in the Indent Book master, reached
  // through the indent the transaction came from.
  if (indentBookIds.length) cond.push(inList(sql`idm.book_no`, indentBookIds));
  if (stockBookIds.length) cond.push(inList(sql`st.stock_book_master_id`, stockBookIds));
  if (categoryIds.length) cond.push(inList(sql`im.category_id`, categoryIds));
  if (itemStatuses.length) cond.push(inList(sql`st.item_status`, itemStatuses));
  if (excludeDeleted) cond.push(sql`st.item_status <> 'DELETED'`);

  // ---- the indent side -----------------------------------------------------
  // An indent line that has never been received has no stock transaction, so
  // the conditions above can never match it and the whole indent is invisible.
  // These rows are reported as "Indented" (still pending) from the indent
  // tables instead, filtered on the same choices.
  const iCond = [sql`ii.display='Y'`, sql`idm.display='Y'`];
  if (from && to) iCond.push(sql`idm.indent_date BETWEEN ${from} AND ${to}`);
  if (instIds.length) iCond.push(inList(sql`idm.institution_id`, instIds));
  if (deptIds.length) iCond.push(inList(sql`idm.department_id`, deptIds));
  if (indentBookIds.length) iCond.push(inList(sql`idm.book_no`, indentBookIds));
  if (stockBookIds.length) iCond.push(inList(sql`ii.stock_book_master_id`, stockBookIds));
  if (categoryIds.length) iCond.push(inList(sql`im.category_id`, categoryIds));
  // A pending line has no stock status, so any status filter excludes it.
  if (itemStatuses.length) iCond.push(sql`false`);

  const plainParams: Record<string, string> = {};
  for (const k of [
    "institution_id",
    "dept_id",
    "indent_book",
    "stock_book",
    "category",
    "from",
    "to",
    "item_status",
    "sort",
    "dir",
    "exclude_deleted",
  ]) {
    const v = one(sp, k);
    if (v) plainParams[k] = v;
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-fg">Custom Stock Report</h1>
          <p className="text-sm text-muted">Group-wise summary & indent-wise detail</p>
        </div>
      </div>

      <FilterBar fields={fields} keep={["tab"]} />
      <ReportTabs
        basePath="/report/custom"
        current={tab}
        params={plainParams}
        tabs={[
          { key: "summary", label: "Summary", icon: ChartPie },
          { key: "detailed", label: "Detailed", icon: ListTree },
        ]}
      />

      <Card className="p-5">
        <div className="printable">
          <ReportHeader
            title={tab === "summary" ? "Stock Summary Report" : "Stock Detailed Report"}
            institution={institution}
            department={department}
            period={periodLabel(from, to)}
          />
          {tab === "summary" ? (
            <SummaryReport
              where={sql.join(cond, sql` AND `)}
              indentWhere={sql.join(iCond, sql` AND `)}
              orderBy={orderBy}
            />
          ) : (
            <DetailedReport
              where={sql.join(cond, sql` AND `)}
              indentWhere={sql.join(iCond, sql` AND `)}
              orderBy={orderBy}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------ Summary tab */
async function SummaryReport({
  where,
  indentWhere,
  orderBy,
}: {
  where: ReturnType<typeof sql.join>;
  indentWhere: ReturnType<typeof sql.join>;
  orderBy: ReturnType<typeof sql>;
}) {
  const result = (await db.execute(sql`
    SELECT
      group_name,
      COUNT(DISTINCT item_id) AS total_items,
      COALESCE(SUM(indented), 0) AS total_indented,
      COALESCE(SUM(received), 0) AS total_received,
      COALESCE(SUM(issued), 0) AS total_issued,
      COALESCE(SUM(transferred), 0) AS total_transferred,
      COALESCE(SUM(written_off), 0) AS total_written_off,
      (
        COALESCE(SUM(received), 0) - COALESCE(SUM(issued), 0)
        - COALESCE(SUM(transferred), 0) - COALESCE(SUM(written_off), 0)
      ) AS total_balance
    FROM (
      -- Stock movements. Every quantity lands in exactly one bucket, so the
      -- columns add up: received - issued - transferred - written off = balance.
      SELECT
        COALESCE(gm.group_name, 'Ungrouped') AS group_name,
        sb.item_id AS item_id,
        0 AS indented,
        COALESCE(st.receipt_qty, 0) AS received,
        CASE WHEN st.transaction_type <> 'TRANSFER' THEN COALESCE(st.issue_qty, 0) ELSE 0 END AS issued,
        CASE WHEN st.transaction_type = 'TRANSFER' THEN COALESCE(st.issue_qty, 0) ELSE 0 END AS transferred,
        CASE WHEN st.item_status = 'DELETED' THEN COALESCE(st.receipt_qty, 0) ELSE 0 END AS written_off
      FROM stock_book_t sb
      JOIN stock_transaction_t st ON st.stock_book_id = sb.id
      LEFT JOIN indent_master_t idm ON idm.id = st.indent_id
      LEFT JOIN item_master_t im ON im.id = sb.item_id
      LEFT JOIN group_item_name_master_t gm ON gm.id = im.group_id
      WHERE ${where}

      UNION ALL

      -- Indent lines still waiting to be received. Disjoint from the rows
      -- above by the NOT EXISTS, so nothing is counted twice.
      SELECT
        COALESCE(gm.group_name, 'Ungrouped') AS group_name,
        ii.item_id AS item_id,
        COALESCE(ii.qty_intended, 0) AS indented,
        0 AS received,
        0 AS issued,
        0 AS transferred,
        0 AS written_off
      FROM indent_item_t ii
      JOIN indent_master_t idm ON idm.id = ii.indent_id
      LEFT JOIN item_master_t im ON im.id = ii.item_id
      LEFT JOIN group_item_name_master_t gm ON gm.id = im.group_id
      WHERE ${indentWhere}
        AND NOT EXISTS (
          SELECT 1 FROM stock_transaction_t st2
          WHERE st2.indent_item_id = ii.id AND st2.display = 'Y'
        )
    ) rows
    GROUP BY group_name
    ORDER BY ${orderBy}
  `)) as unknown as Record<string, unknown>[];

  const rows = result.map((r) => ({
    group_name: (r.group_name as string) ?? "Ungrouped",
    total_items: num(r.total_items),
    total_indented: num(r.total_indented),
    total_received: num(r.total_received),
    total_issued: num(r.total_issued),
    total_transferred: num(r.total_transferred),
    total_written_off: num(r.total_written_off),
    total_balance: num(r.total_balance),
  }));

  const t = rows.reduce(
    (a, r) => ({
      items: a.items + r.total_items,
      indented: a.indented + r.total_indented,
      received: a.received + r.total_received,
      issued: a.issued + r.total_issued,
      transferred: a.transferred + r.total_transferred,
      writtenOff: a.writtenOff + r.total_written_off,
      balance: a.balance + r.total_balance,
    }),
    { items: 0, indented: 0, received: 0, issued: 0, transferred: 0, writtenOff: 0, balance: 0 }
  );

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Item Groups" value={rows.length} grad="grad-violet" />
        <StatCard label="Items" value={t.items} grad="grad-blue" />
        <StatCard label="Indented" value={t.indented} grad="grad-cyan" />
        <StatCard label="Received" value={t.received} grad="grad-green" />
        <StatCard label="Issued" value={t.issued} grad="grad-rose" />
        <StatCard label="Transferred" value={t.transferred} grad="grad-violet" />
        <StatCard label="Written Off" value={t.writtenOff} grad="grad-amber" />
        <StatCard label="Balance" value={t.balance} grad="grad-cyan" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-elevated text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="w-12 px-3 py-2 text-center font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Group / Item Name</th>
              <th className="px-3 py-2 text-center font-semibold">Items</th>
              <th className="px-3 py-2 text-center font-semibold">Indented</th>
              <th className="px-3 py-2 text-center font-semibold">Received</th>
              <th className="px-3 py-2 text-center font-semibold">Issued</th>
              <th className="px-3 py-2 text-center font-semibold">Transferred</th>
              <th className="px-3 py-2 text-center font-semibold">Written Off</th>
              <th className="px-3 py-2 text-center font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-faint">
                  No records found for the selected filters.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line/60">
                <td className="px-3 py-2 text-center text-faint">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-fg">{r.group_name}</td>
                <td className="px-3 py-2 text-center">{r.total_items}</td>
                <td className="px-3 py-2 text-center text-sky-500">{r.total_indented}</td>
                <td className="px-3 py-2 text-center font-semibold text-emerald-600">{r.total_received}</td>
                <td className="px-3 py-2 text-center text-rose-600">{r.total_issued}</td>
                <td className="px-3 py-2 text-center text-violet-500">{r.total_transferred}</td>
                <td className="px-3 py-2 text-center text-amber-600">{r.total_written_off}</td>
                <td className="px-3 py-2 text-center font-bold text-fg">{r.total_balance}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-line bg-elevated font-bold text-fg">
                <td colSpan={2} className="px-3 py-2 text-right">TOTAL</td>
                <td className="px-3 py-2 text-center">{t.items}</td>
                <td className="px-3 py-2 text-center">{t.indented}</td>
                <td className="px-3 py-2 text-center">{t.received}</td>
                <td className="px-3 py-2 text-center">{t.issued}</td>
                <td className="px-3 py-2 text-center">{t.transferred}</td>
                <td className="px-3 py-2 text-center">{t.writtenOff}</td>
                <td className="px-3 py-2 text-center">{t.balance}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ Detailed tab */
async function DetailedReport({
  where,
  indentWhere,
  orderBy,
}: {
  where: ReturnType<typeof sql.join>;
  indentWhere: ReturnType<typeof sql.join>;
  orderBy: ReturnType<typeof sql>;
}) {
  const result = (await db.execute(sql`
    SELECT * FROM (
      SELECT
        COALESCE(gm.group_name, 'Ungrouped') AS group_name,
        idm.indent_no,
        idm.indent_date,
        im.item_name,
        ii.item_description,
        mk.make_name,
        md.model_name,
        st.transaction_type,
        0 AS indented,
        COALESCE(st.receipt_qty, 0) AS receipt_qty,
        CASE WHEN st.transaction_type = 'TRANSFER' THEN 0 ELSE COALESCE(st.issue_qty, 0) END AS issue_qty,
        CASE WHEN st.transaction_type = 'TRANSFER' THEN COALESCE(st.issue_qty, 0) ELSE 0 END AS transfer_qty,
        CASE WHEN st.item_status = 'DELETED' THEN COALESCE(st.receipt_qty, 0) ELSE 0 END AS written_off,
        -- Not clamped: a transfer out is a negative line, and clamping it to 0
        -- made the subtotals disagree with the summary tab.
        (
          COALESCE(st.receipt_qty, 0) - COALESCE(st.issue_qty, 0)
          - CASE WHEN st.item_status = 'DELETED' THEN COALESCE(st.receipt_qty, 0) ELSE 0 END
        ) AS balance
      FROM stock_transaction_t st
      LEFT JOIN stock_book_t sb ON st.stock_book_id = sb.id
      LEFT JOIN indent_master_t idm ON st.indent_id = idm.id
      LEFT JOIN item_master_t im ON sb.item_id = im.id
      LEFT JOIN group_item_name_master_t gm ON im.group_id = gm.id
      LEFT JOIN indent_item_t ii ON st.indent_item_id = ii.id
      LEFT JOIN make_t mk ON ii.make_id = mk.id
      LEFT JOIN model_t md ON ii.model_id = md.id
      WHERE ${where}

      UNION ALL

      -- Indent lines with no stock movement yet: shown as indented, with no
      -- quantity in the stock columns.
      SELECT
        COALESCE(gm.group_name, 'Ungrouped') AS group_name,
        idm.indent_no,
        idm.indent_date,
        im.item_name,
        ii.item_description,
        mk.make_name,
        md.model_name,
        'INDENT' AS transaction_type,
        COALESCE(ii.qty_intended, 0) AS indented,
        0 AS receipt_qty,
        0 AS issue_qty,
        0 AS transfer_qty,
        0 AS written_off,
        0 AS balance
      FROM indent_item_t ii
      JOIN indent_master_t idm ON idm.id = ii.indent_id
      LEFT JOIN item_master_t im ON im.id = ii.item_id
      LEFT JOIN group_item_name_master_t gm ON gm.id = im.group_id
      LEFT JOIN make_t mk ON mk.id = ii.make_id
      LEFT JOIN model_t md ON md.id = ii.model_id
      WHERE ${indentWhere}
        AND NOT EXISTS (
          SELECT 1 FROM stock_transaction_t st2
          WHERE st2.indent_item_id = ii.id AND st2.display = 'Y'
        )
    ) rows
    ORDER BY ${orderBy} NULLS LAST, group_name ASC, item_name ASC, indent_date ASC, indent_no ASC
  `)) as unknown as Record<string, unknown>[];

  const rows = result.map((r) => ({
    group_name: (r.group_name as string) ?? "Ungrouped",
    indent_no: (r.indent_no as string) ?? null,
    indent_date: (r.indent_date as string | Date | null) ?? null,
    item_name: (r.item_name as string) ?? "—",
    item_description: (r.item_description as string) ?? null,
    make_name: (r.make_name as string) ?? null,
    model_name: (r.model_name as string) ?? null,
    transaction_type: (r.transaction_type as string) ?? "",
    indented: num(r.indented),
    receipt_qty: num(r.receipt_qty),
    issue_qty: num(r.issue_qty),
    transfer_qty: num(r.transfer_qty),
    written_off: num(r.written_off),
    balance: num(r.balance),
  }));

  // Build display rows with group / item headers, subtotals and a grand total.
  const cells: React.ReactNode[] = [];
  const acc = { n: 0, r: 0, i: 0, t: 0, w: 0, b: 0 };
  let group = "";
  let item = "";
  let sub = { n: 0, r: 0, i: 0, t: 0, w: 0, b: 0 };

  const flushItem = (name: string) => {
    cells.push(
      <tr key={`sub-${cells.length}`} className="bg-sky-500/10 font-semibold text-sky-700 print-avoid-break">
        <td colSpan={6} className="px-3 py-1.5 text-right">Subtotal · {name}</td>
        <td className="px-3 py-1.5 text-center">{sub.n}</td>
        <td className="px-3 py-1.5 text-center">{sub.r}</td>
        <td className="px-3 py-1.5 text-center">{sub.i}</td>
        <td className="px-3 py-1.5 text-center">{sub.t}</td>
        <td className="px-3 py-1.5 text-center">{sub.w}</td>
        <td className="px-3 py-1.5 text-center">{sub.b}</td>
      </tr>
    );
    sub = { n: 0, r: 0, i: 0, t: 0, w: 0, b: 0 };
  };

  rows.forEach((r, idx) => {
    if (group !== r.group_name) {
      group = r.group_name;
      item = "";
      cells.push(
        <tr key={`g-${idx}`} className="bg-elevated font-bold text-fg print-avoid-break">
          <td colSpan={12} className="px-3 py-2">▸ {group || "Ungrouped"}</td>
        </tr>
      );
    }
    if (item !== r.item_name) {
      item = r.item_name;
      cells.push(
        <tr key={`it-${idx}`} className="bg-elevated/60 font-semibold text-accent">
          <td colSpan={12} className="px-3 py-1.5 pl-6">{item}</td>
        </tr>
      );
    }

    const makeModel = [r.make_name, r.model_name].filter(Boolean).join(" / ") || "—";
    cells.push(
      <tr key={`r-${idx}`} className="border-b border-line/60">
        <td className="px-3 py-2 text-center text-faint">{idx + 1}</td>
        <td className="px-3 py-2">{r.item_description || "—"}</td>
        <td className="px-3 py-2 text-center">{r.indent_no || "—"}</td>
        <td className="px-3 py-2 whitespace-nowrap text-center text-muted">
          {r.indent_date ? formatDate(r.indent_date) : "—"}
        </td>
        <td className="px-3 py-2">{makeModel}</td>
        <td className="px-3 py-2 text-center text-xs">{r.transaction_type || "—"}</td>
        <td className="px-3 py-2 text-center text-sky-500">{r.indented}</td>
        <td className="px-3 py-2 text-center">{r.receipt_qty}</td>
        <td className="px-3 py-2 text-center text-rose-600">{r.issue_qty}</td>
        <td className="px-3 py-2 text-center text-violet-500">{r.transfer_qty}</td>
        <td className="px-3 py-2 text-center text-amber-600">{r.written_off}</td>
        <td className="px-3 py-2 text-center font-semibold text-fg">{r.balance}</td>
      </tr>
    );

    acc.n += r.indented; acc.r += r.receipt_qty; acc.i += r.issue_qty;
    acc.t += r.transfer_qty; acc.w += r.written_off; acc.b += r.balance;
    sub.n += r.indented; sub.r += r.receipt_qty; sub.i += r.issue_qty;
    sub.t += r.transfer_qty; sub.w += r.written_off; sub.b += r.balance;

    const next = rows[idx + 1];
    if (!next || next.item_name !== r.item_name || next.group_name !== r.group_name) {
      flushItem(r.item_name);
    }
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm" style={{ minWidth: "66rem" }}>
        <thead>
          <tr className="border-b border-line bg-elevated text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="w-12 px-3 py-2 text-center font-semibold">#</th>
            <th className="px-3 py-2 font-semibold">Description</th>
            <th className="px-3 py-2 text-center font-semibold">Indent No</th>
            <th className="px-3 py-2 text-center font-semibold">Indent Date</th>
            <th className="px-3 py-2 font-semibold">Make / Model</th>
            <th className="px-3 py-2 text-center font-semibold">Type</th>
            <th className="px-3 py-2 text-center font-semibold">Indented</th>
            <th className="px-3 py-2 text-center font-semibold">Received</th>
            <th className="px-3 py-2 text-center font-semibold">Issued</th>
            <th className="px-3 py-2 text-center font-semibold">Transferred</th>
            <th className="px-3 py-2 text-center font-semibold">Written Off</th>
            <th className="px-3 py-2 text-center font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody>
          {cells.length === 0 ? (
            <tr>
              <td colSpan={12} className="px-3 py-8 text-center text-faint">
                No records found for the selected filters.
              </td>
            </tr>
          ) : (
            cells
          )}
        </tbody>
        {cells.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-line bg-elevated font-bold text-fg">
              <td colSpan={6} className="px-3 py-2 text-right">GRAND TOTAL</td>
              <td className="px-3 py-2 text-center">{acc.n}</td>
              <td className="px-3 py-2 text-center">{acc.r}</td>
              <td className="px-3 py-2 text-center">{acc.i}</td>
              <td className="px-3 py-2 text-center">{acc.t}</td>
              <td className="px-3 py-2 text-center">{acc.w}</td>
              <td className="px-3 py-2 text-center">{acc.b}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
