import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ChartPie, ListTree } from "lucide-react";
import { Card } from "@/components/ui/card";
import FilterBar, { type FilterField } from "../_components/filter-bar";
import { ReportTabs, ReportHeader, StatCard } from "../_components/report-ui";
import {
  getReportOptions,
  resolveInstDept,
  intParam,
  dateParam,
  one,
  periodLabel,
  type SP,
} from "../_components/report-data";

const num = (v: unknown) => Number(v ?? 0);

export default async function CustomReportPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const tab = one(sp, "tab") === "detailed" ? "detailed" : "summary";

  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to");
  const instId = intParam(sp, "institution_id");
  const deptId = intParam(sp, "dept_id");
  const itemStatus = one(sp, "item_status");
  const excludeDeleted = one(sp, "exclude_deleted") === "1";

  const [{ institutions, departments }, { institution, department }] = await Promise.all([
    getReportOptions(),
    resolveInstDept(sp),
  ]);

  const fields: FilterField[] = [
    { key: "institution_id", label: "Institution", type: "select", options: institutions, placeholder: "All Institutions" },
    { key: "dept_id", label: "Department", type: "select", options: departments, dependsOn: "institution_id", placeholder: "All Departments" },
    { key: "from", label: "From Date", type: "date" },
    { key: "to", label: "To Date", type: "date" },
    {
      key: "item_status",
      label: "Item Status",
      type: "select",
      placeholder: "All Statuses",
      options: [
        { value: "WORKING", label: "Working" },
        { value: "NOT_WORKING", label: "Not working" },
        { value: "DAMAGED", label: "Damaged" },
        { value: "CONDEMNED", label: "Condemned" },
        { value: "DELETED", label: "Deleted" },
      ],
    },
    { key: "exclude_deleted", label: "Exclude deleted items", type: "toggle" },
  ];

  // Shared WHERE fragments (parameterized → injection-safe).
  const cond = [sql`st.display='Y'`];
  if (from && to) cond.push(sql`st.transaction_date BETWEEN ${from} AND ${to}`);
  if (instId) cond.push(sql`st.institution_id = ${instId}`);
  if (deptId) cond.push(sql`st.department_id = ${deptId}`);
  if (itemStatus) cond.push(sql`st.item_status = ${itemStatus}`);
  if (excludeDeleted) cond.push(sql`st.item_status <> 'DELETED'`);

  const plainParams: Record<string, string> = {};
  for (const k of ["institution_id", "dept_id", "from", "to", "item_status", "exclude_deleted"]) {
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
            <SummaryReport where={sql.join(cond, sql` AND `)} />
          ) : (
            <DetailedReport where={sql.join(cond, sql` AND `)} />
          )}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------ Summary tab */
async function SummaryReport({ where }: { where: ReturnType<typeof sql.join> }) {
  const result = (await db.execute(sql`
    SELECT
      COALESCE(gm.group_name, 'Ungrouped') AS group_name,
      COUNT(DISTINCT sb.id) AS total_items,
      SUM(CASE WHEN st.transaction_type IN ('RECEIPT','TRANSFER') THEN st.receipt_qty ELSE 0 END) AS total_received,
      SUM(CASE WHEN st.transaction_type='RECEIPT' AND st.stock_entry_type='INDENT_BASED' THEN st.receipt_qty ELSE 0 END) AS indent_received,
      SUM(CASE WHEN st.transaction_type='TRANSFER' THEN st.receipt_qty ELSE 0 END) AS transfer_received,
      SUM(CASE WHEN st.transaction_type='ISSUE' AND st.item_status <> 'DELETED' THEN st.issue_qty ELSE 0 END) AS total_issued,
      SUM(CASE WHEN st.item_status='DELETED' THEN ii.qty_intended ELSE 0 END) AS total_deleted,
      (
        SUM(CASE WHEN st.transaction_type IN ('RECEIPT','TRANSFER') THEN st.receipt_qty ELSE 0 END)
        - SUM(CASE WHEN st.transaction_type='ISSUE' AND st.item_status <> 'DELETED' THEN st.issue_qty ELSE 0 END)
        - SUM(CASE WHEN st.item_status='DELETED' THEN ii.qty_intended ELSE 0 END)
      ) AS total_balance
    FROM stock_book_t sb
    LEFT JOIN stock_transaction_t st ON st.stock_book_id = sb.id
    LEFT JOIN indent_item_t ii ON ii.id = st.indent_item_id
    LEFT JOIN item_master_t im ON im.id = sb.item_id
    LEFT JOIN group_item_name_master_t gm ON gm.id = im.group_id
    WHERE ${where}
    GROUP BY gm.id
    ORDER BY group_name ASC
  `)) as unknown as Record<string, unknown>[];

  const rows = result.map((r) => ({
    group_name: (r.group_name as string) ?? "Ungrouped",
    total_items: num(r.total_items),
    total_received: num(r.total_received),
    total_issued: num(r.total_issued),
    total_deleted: num(r.total_deleted),
    total_balance: num(r.total_balance),
  }));

  const t = rows.reduce(
    (a, r) => ({
      items: a.items + r.total_items,
      received: a.received + r.total_received,
      issued: a.issued + r.total_issued,
      deleted: a.deleted + r.total_deleted,
      balance: a.balance + r.total_balance,
    }),
    { items: 0, received: 0, issued: 0, deleted: 0, balance: 0 }
  );

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Item Groups" value={rows.length} grad="grad-violet" />
        <StatCard label="Total Items" value={t.items} grad="grad-blue" />
        <StatCard label="Received" value={t.received} grad="grad-green" />
        <StatCard label="Issued" value={t.issued} grad="grad-rose" />
        <StatCard label="Deleted" value={t.deleted} grad="grad-amber" />
        <StatCard label="Balance" value={t.balance} grad="grad-cyan" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-elevated text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="w-12 px-3 py-2 text-center font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Group / Item Name</th>
              <th className="px-3 py-2 text-center font-semibold">Items</th>
              <th className="px-3 py-2 text-center font-semibold">Received</th>
              <th className="px-3 py-2 text-center font-semibold">Issued</th>
              <th className="px-3 py-2 text-center font-semibold">Deleted</th>
              <th className="px-3 py-2 text-center font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-faint">
                  No records found for the selected filters.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line/60">
                <td className="px-3 py-2 text-center text-faint">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-fg">{r.group_name}</td>
                <td className="px-3 py-2 text-center">{r.total_items}</td>
                <td className="px-3 py-2 text-center font-semibold text-emerald-600">{r.total_received}</td>
                <td className="px-3 py-2 text-center text-rose-600">{r.total_issued}</td>
                <td className="px-3 py-2 text-center text-amber-600">{r.total_deleted}</td>
                <td className="px-3 py-2 text-center font-bold text-fg">{r.total_balance}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-line bg-elevated font-bold text-fg">
                <td colSpan={2} className="px-3 py-2 text-right">TOTAL</td>
                <td className="px-3 py-2 text-center">{t.items}</td>
                <td className="px-3 py-2 text-center">{t.received}</td>
                <td className="px-3 py-2 text-center">{t.issued}</td>
                <td className="px-3 py-2 text-center">{t.deleted}</td>
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
async function DetailedReport({ where }: { where: ReturnType<typeof sql.join> }) {
  const result = (await db.execute(sql`
    SELECT
      gm.group_name,
      idm.indent_no,
      im.item_name,
      ii.item_description,
      mk.make_name,
      md.model_name,
      st.transaction_type,
      st.receipt_qty,
      st.issue_qty,
      CASE WHEN st.item_status='DELETED' THEN st.receipt_qty ELSE 0 END AS deleted_quantity,
      GREATEST(
        st.receipt_qty - (st.issue_qty + CASE WHEN st.item_status='DELETED' THEN st.receipt_qty ELSE 0 END),
        0
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
    ORDER BY gm.group_name ASC, ii.indent_id ASC, im.item_name ASC
  `)) as unknown as Record<string, unknown>[];

  const rows = result.map((r) => ({
    group_name: (r.group_name as string) ?? "Ungrouped",
    indent_no: (r.indent_no as string) ?? null,
    item_name: (r.item_name as string) ?? "—",
    item_description: (r.item_description as string) ?? null,
    make_name: (r.make_name as string) ?? null,
    model_name: (r.model_name as string) ?? null,
    transaction_type: (r.transaction_type as string) ?? "",
    receipt_qty: num(r.receipt_qty),
    issue_qty: num(r.issue_qty),
    deleted_quantity: num(r.deleted_quantity),
    balance: num(r.balance),
  }));

  // Build display rows with group / item headers, subtotals and a grand total.
  const cells: React.ReactNode[] = [];
  const acc = { r: 0, i: 0, d: 0, b: 0 };
  let group = "";
  let item = "";
  let sub = { r: 0, i: 0, d: 0, b: 0 };

  const flushItem = (name: string) => {
    cells.push(
      <tr key={`sub-${cells.length}`} className="bg-sky-500/10 font-semibold text-sky-700 print-avoid-break">
        <td colSpan={6} className="px-3 py-1.5 text-right">Subtotal · {name}</td>
        <td className="px-3 py-1.5 text-center">{sub.r}</td>
        <td className="px-3 py-1.5 text-center">{sub.i}</td>
        <td className="px-3 py-1.5 text-center">{sub.d}</td>
        <td className="px-3 py-1.5 text-center">{sub.b}</td>
      </tr>
    );
    sub = { r: 0, i: 0, d: 0, b: 0 };
  };

  rows.forEach((r, idx) => {
    if (group !== r.group_name) {
      group = r.group_name;
      item = "";
      cells.push(
        <tr key={`g-${idx}`} className="bg-elevated font-bold text-fg print-avoid-break">
          <td colSpan={10} className="px-3 py-2">▸ {group || "Ungrouped"}</td>
        </tr>
      );
    }
    if (item !== r.item_name) {
      item = r.item_name;
      cells.push(
        <tr key={`it-${idx}`} className="bg-elevated/60 font-semibold text-accent">
          <td colSpan={10} className="px-3 py-1.5 pl-6">{item}</td>
        </tr>
      );
    }

    const makeModel = [r.make_name, r.model_name].filter(Boolean).join(" / ") || "—";
    cells.push(
      <tr key={`r-${idx}`} className="border-b border-line/60">
        <td className="px-3 py-2 text-center text-faint">{idx + 1}</td>
        <td className="px-3 py-2">{r.item_description || "—"}</td>
        <td className="px-3 py-2 text-center">{r.indent_no || "—"}</td>
        <td className="px-3 py-2">{makeModel}</td>
        <td className="px-3 py-2 text-center text-xs">{r.transaction_type || "—"}</td>
        <td className="px-3 py-2 text-center">{r.receipt_qty}</td>
        <td className="px-3 py-2 text-center text-rose-600">{r.issue_qty}</td>
        <td className="px-3 py-2 text-center text-amber-600">{r.deleted_quantity}</td>
        <td className="px-3 py-2 text-center font-semibold text-fg">{r.balance}</td>
        <td className="px-3 py-2" />
      </tr>
    );

    acc.r += r.receipt_qty; acc.i += r.issue_qty; acc.d += r.deleted_quantity; acc.b += r.balance;
    sub.r += r.receipt_qty; sub.i += r.issue_qty; sub.d += r.deleted_quantity; sub.b += r.balance;

    const next = rows[idx + 1];
    if (!next || next.item_name !== r.item_name || next.group_name !== r.group_name) {
      flushItem(r.item_name);
    }
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm" style={{ minWidth: "56rem" }}>
        <thead>
          <tr className="border-b border-line bg-elevated text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="w-12 px-3 py-2 text-center font-semibold">#</th>
            <th className="px-3 py-2 font-semibold">Description</th>
            <th className="px-3 py-2 text-center font-semibold">Indent No</th>
            <th className="px-3 py-2 font-semibold">Make / Model</th>
            <th className="px-3 py-2 text-center font-semibold">Type</th>
            <th className="px-3 py-2 text-center font-semibold">Received</th>
            <th className="px-3 py-2 text-center font-semibold">Issued</th>
            <th className="px-3 py-2 text-center font-semibold">Deleted</th>
            <th className="px-3 py-2 text-center font-semibold">Balance</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {cells.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-3 py-8 text-center text-faint">
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
              <td colSpan={5} className="px-3 py-2 text-right">GRAND TOTAL</td>
              <td className="px-3 py-2 text-center">{acc.r}</td>
              <td className="px-3 py-2 text-center">{acc.i}</td>
              <td className="px-3 py-2 text-center">{acc.d}</td>
              <td className="px-3 py-2 text-center">{acc.b}</td>
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
