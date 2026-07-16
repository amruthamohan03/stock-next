import { sql } from "drizzle-orm";
import { db } from "@/db";
import { FileText, PackageOpen, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import FilterBar, { type FilterField } from "../_components/filter-bar";
import { ReportTabs, ReportHeader } from "../_components/report-ui";
import {
  getReportOptions,
  resolveInstDept,
  intParam,
  dateParam,
  one,
  periodLabel,
  academicYear,
  type SP,
} from "../_components/report-data";

const num = (v: unknown) => Number(v ?? 0);

const ITEM_TYPE_CN: FilterField["options"] = [
  { value: "C", label: "Consumable" },
  { value: "N", label: "Non-Consumable" },
];
const EQ_TYPE: FilterField["options"] = [
  { value: "FURNITURE", label: "Furniture" },
  { value: "ELECTRONIC", label: "Electronic / Equipment" },
  { value: "OTHERS", label: "Others" },
];

/** SQL fragment for the category (eq_type) filter on an item alias' category_id. */
function eqTypeCond(eq: string, col: string) {
  if (eq === "FURNITURE") return sql`${sql.raw(col)} = 1`;
  if (eq === "ELECTRONIC") return sql`${sql.raw(col)} = 2`;
  if (eq === "OTHERS") return sql`(${sql.raw(col)} NOT IN (1,2) OR ${sql.raw(col)} IS NULL)`;
  return null;
}

export default async function BookReportPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const tab = ["stock", "day"].includes(one(sp, "tab")) ? one(sp, "tab") : "indent";

  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to");

  const [{ institutions, departments }, { institution, department }] = await Promise.all([
    getReportOptions(),
    resolveInstDept(sp),
  ]);

  const instDept: FilterField[] = [
    { key: "institution_id", label: "Institution", type: "select", options: institutions, placeholder: "All Institutions" },
    { key: "dept_id", label: "Department", type: "select", options: departments, dependsOn: "institution_id", placeholder: "All Departments" },
    { key: "from", label: "From Date", type: "date" },
    { key: "to", label: "To Date", type: "date" },
  ];

  const fieldsByTab: Record<string, FilterField[]> = {
    indent: [
      ...instDept,
      { key: "item_type", label: "Item Type", type: "select", options: ITEM_TYPE_CN },
      { key: "eq_type", label: "Category", type: "select", options: EQ_TYPE },
      { key: "book_no", label: "Book No", type: "number", placeholder: "All" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["CREATED", "VERIFIED", "PASSED", "ISSUED", "RECEIVED"].map((s) => ({ value: s, label: s[0] + s.slice(1).toLowerCase() })),
      },
    ],
    stock: [
      ...instDept,
      {
        key: "txn_type",
        label: "Transaction Type",
        type: "select",
        options: ["RECEIPT", "ISSUE", "BROUGHT_FORWARD", "ADJUSTMENT"].map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
      },
      { key: "eq_type", label: "Category", type: "select", options: EQ_TYPE },
      { key: "item_type", label: "Item Type", type: "select", options: ITEM_TYPE_CN },
    ],
    day: [
      ...instDept,
      {
        key: "sb_type",
        label: "Stock Book Type",
        type: "select",
        options: [
          { value: "MAIN", label: "Main Stock Book" },
          { value: "DEAD", label: "Dead Stock Book" },
          { value: "PERISH", label: "Perishable" },
          { value: "CONSUM", label: "Consumable" },
        ],
      },
      {
        key: "item_type",
        label: "Item Type",
        type: "select",
        options: [
          { value: "CONSUMABLE", label: "Consumable" },
          { value: "NON_CONSUMABLE", label: "Non-Consumable" },
        ],
      },
      { key: "eq_type", label: "Category", type: "select", options: EQ_TYPE },
      {
        key: "txn_type",
        label: "Txn Type",
        type: "select",
        options: [
          { value: "RECEIPT", label: "Receipt" },
          { value: "ISSUE", label: "Issue" },
        ],
      },
    ],
  };

  const plainParams: Record<string, string> = {};
  for (const f of fieldsByTab[tab]) {
    const v = one(sp, f.key);
    if (v) plainParams[f.key] = v;
  }

  const titleByTab: Record<string, string> = {
    indent: "Indent Book",
    stock: "Stock Book of Stores",
    day: "Day Book of Stores (KFC Form 16)",
  };

  return (
    <div className="space-y-4">
      <div className="no-print">
        <h1 className="text-xl font-bold text-fg">Stock Register — Report Print</h1>
        <p className="text-sm text-muted">Indent Book · Stock Book · Day Book</p>
      </div>

      <ReportTabs
        basePath="/report/book"
        current={tab}
        params={plainParams}
        tabs={[
          { key: "indent", label: "Indent Book", icon: FileText },
          { key: "stock", label: "Stock Book", icon: PackageOpen },
          { key: "day", label: "Day Book", icon: CalendarDays },
        ]}
      />
      <FilterBar fields={fieldsByTab[tab]} keep={["tab"]} />

      <Card className="p-5">
        <div className="printable">
          <ReportHeader
            title={titleByTab[tab]}
            institution={institution}
            department={department}
            period={periodLabel(from, to)}
            meta={academicYear(from) ? `A.Y. ${academicYear(from)}` : null}
          />
          {tab === "indent" ? (
            <IndentBook sp={sp} />
          ) : tab === "stock" ? (
            <StockBook sp={sp} />
          ) : (
            <DayBook sp={sp} />
          )}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------ Indent Book */
async function IndentBook({ sp }: { sp: SP }) {
  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to");
  const cond = [sql`im.display='Y'`];
  if (from && to) cond.push(sql`im.indent_date BETWEEN ${from} AND ${to}`);
  const itemType = one(sp, "item_type");
  if (itemType === "C" || itemType === "N") cond.push(sql`im.item_type=${itemType}`);
  const bookNo = intParam(sp, "book_no");
  if (bookNo) cond.push(sql`im.book_no=${bookNo}`);
  const status = one(sp, "status");
  if (status) cond.push(sql`im.status=${status}`);
  const eq = eqTypeCond(one(sp, "eq_type"), "imt.category_id");
  if (eq) cond.push(eq);
  const inst = intParam(sp, "institution_id");
  if (inst) cond.push(sql`im.institution_id=${inst}`);
  const dept = intParam(sp, "dept_id");
  if (dept) cond.push(sql`im.department_id=${dept}`);

  const result = (await db.execute(sql`
    SELECT im.id, im.book_no, im.indent_no,
           to_char(im.indent_date,'DD-MM-YYYY') AS indent_date,
           im.item_type, im.status,
           dep.department_name,
           ii.sl_no, ii.item_description, ii.item_purpose,
           ii.qty_intended, ii.qty_passed, ii.qty_issued, ii.remarks,
           imt.item_name, mk.make_name, md.model_name
    FROM indent_master_t im
    LEFT JOIN department_master_t dep ON dep.id = im.department_id
    LEFT JOIN indent_item_t ii ON ii.indent_id = im.id AND ii.display='Y'
    LEFT JOIN item_master_t imt ON imt.id = ii.item_id
    LEFT JOIN make_t mk ON mk.id = ii.make_id
    LEFT JOIN model_t md ON md.id = ii.model_id
    WHERE ${sql.join(cond, sql` AND `)}
    ORDER BY im.indent_date DESC, im.book_no, im.indent_no, ii.sl_no
  `)) as unknown as Record<string, unknown>[];

  // Group rows by indent.
  const groups = new Map<string, { head: Record<string, unknown>; items: Record<string, unknown>[] }>();
  for (const r of result) {
    const key = `${r.book_no}|${r.indent_no}`;
    if (!groups.has(key)) groups.set(key, { head: r, items: [] });
    if (r.sl_no) groups.get(key)!.items.push(r);
  }

  if (groups.size === 0) return <NoData />;

  let sl = 0;
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm" style={{ minWidth: "56rem" }}>
        <thead>
          <tr className="border-b border-line bg-elevated text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="w-10 px-3 py-2 text-center font-semibold">#</th>
            <th className="px-3 py-2 font-semibold">Particulars</th>
            <th className="px-3 py-2 font-semibold">Make / Model</th>
            <th className="px-3 py-2 font-semibold">Purpose</th>
            <th className="px-3 py-2 text-center font-semibold">Intended</th>
            <th className="px-3 py-2 text-center font-semibold">Passed</th>
            <th className="px-3 py-2 text-center font-semibold">Issued</th>
            <th className="px-3 py-2 font-semibold">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {[...groups.values()].map((g, gi) => (
            <IndentGroup key={gi} g={g} />
          ))}
        </tbody>
      </table>
    </div>
  );

  function IndentGroup({ g }: { g: { head: Record<string, unknown>; items: Record<string, unknown>[] } }) {
    const h = g.head;
    return (
      <>
        <tr className="bg-elevated font-semibold text-fg print-avoid-break">
          <td colSpan={8} className="px-3 py-2">
            <span className="text-accent">Indent {String(h.indent_no)}</span>
            <span className="text-muted"> · {String(h.indent_date)} · Book {String(h.book_no)} · </span>
            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">{String(h.status ?? "")}</span>
            <span className="text-muted"> · {String(h.item_type) === "C" ? "Consumable" : "Non-Consumable"}</span>
            {h.department_name ? <span className="text-faint"> · {String(h.department_name)}</span> : null}
          </td>
        </tr>
        {g.items.length === 0 ? (
          <tr className="border-b border-line/60">
            <td colSpan={8} className="px-3 py-2 text-center text-faint">No items</td>
          </tr>
        ) : (
          g.items.map((it, i) => (
            <tr key={i} className="border-b border-line/60">
              <td className="px-3 py-2 text-center text-faint">{++sl}</td>
              <td className="px-3 py-2">
                <span className="font-medium text-fg">{String(it.item_name ?? "—")}</span>
                {it.item_description ? <div className="text-xs text-faint">{String(it.item_description)}</div> : null}
              </td>
              <td className="px-3 py-2">{[it.make_name, it.model_name].filter(Boolean).join(" / ") || "—"}</td>
              <td className="px-3 py-2">{String(it.item_purpose ?? "—")}</td>
              <td className="px-3 py-2 text-center font-semibold">{num(it.qty_intended)}</td>
              <td className="px-3 py-2 text-center">{num(it.qty_passed)}</td>
              <td className="px-3 py-2 text-center">{num(it.qty_issued)}</td>
              <td className="px-3 py-2 text-xs">{String(it.remarks ?? "")}</td>
            </tr>
          ))
        )}
      </>
    );
  }
}

/* ------------------------------------------------------------ Stock Book */
async function StockBook({ sp }: { sp: SP }) {
  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to");
  const cond = [sql`sb.display='Y'`];
  if (from && to) cond.push(sql`st.transaction_date BETWEEN ${from} AND ${to}`);
  const txn = one(sp, "txn_type");
  if (txn) cond.push(sql`st.transaction_type=${txn}`);
  const eq = eqTypeCond(one(sp, "eq_type"), "imt.category_id");
  if (eq) cond.push(eq);
  const itemType = one(sp, "item_type");
  if (itemType === "C" || itemType === "N") cond.push(sql`imt.tax_not_tax=${itemType}`);
  const inst = intParam(sp, "institution_id");
  if (inst) cond.push(sql`st.institution_id=${inst}`);
  const dept = intParam(sp, "dept_id");
  if (dept) cond.push(sql`st.department_id=${dept}`);

  const result = (await db.execute(sql`
    SELECT st.id, st.stock_book_id,
           to_char(st.transaction_date,'DD-MM-YYYY') AS transaction_date,
           st.transaction_type, st.voucher_no,
           to_char(st.voucher_date,'DD-MM-YYYY') AS voucher_date,
           st.received_from, st.issued_to,
           st.receipt_qty, st.issue_qty, st.balance_qty,
           st.receiver_initial, st.remarks,
           sb.location, sb.opening_balance,
           imt.item_name, im_i.indent_no AS indent_ref
    FROM stock_transaction_t st
    INNER JOIN stock_book_t sb ON sb.id = st.stock_book_id
    INNER JOIN item_master_t imt ON imt.id = sb.item_id
    LEFT JOIN indent_master_t im_i ON im_i.id = st.indent_id
    WHERE ${sql.join(cond, sql` AND `)}
    ORDER BY st.stock_book_id ASC, st.transaction_date ASC, st.id ASC
  `)) as unknown as Record<string, unknown>[];

  const books = new Map<number, { head: Record<string, unknown>; rows: Record<string, unknown>[] }>();
  for (const r of result) {
    const id = num(r.stock_book_id);
    if (!books.has(id)) books.set(id, { head: r, rows: [] });
    books.get(id)!.rows.push(r);
  }

  if (books.size === 0) return <NoData />;

  const txnColor: Record<string, string> = {
    RECEIPT: "text-emerald-600",
    ISSUE: "text-rose-600",
    BROUGHT_FORWARD: "text-blue-600",
    ADJUSTMENT: "text-amber-600",
  };

  return (
    <div className="space-y-6">
      {[...books.entries()].map(([id, b]) => {
        const page = `ST-${String(id).padStart(2, "0")}`;
        const opening = num(b.head.opening_balance);
        const last = b.rows.length ? num(b.rows[b.rows.length - 1].balance_qty) : opening;
        return (
          <div key={id} className="overflow-x-auto rounded-lg border border-line print-avoid-break">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-elevated px-3 py-2">
              <div className="font-semibold text-fg">
                {String(b.head.item_name ?? "Item")}
                {b.head.location ? <span className="text-faint"> · {String(b.head.location)}</span> : null}
              </div>
              <div className="font-mono text-sm font-bold text-accent">{page}</div>
            </div>
            <table className="w-full text-sm" style={{ minWidth: "52rem" }}>
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Voucher / Ref</th>
                  <th className="px-3 py-2 font-semibold">From / To</th>
                  <th className="px-3 py-2 text-center font-semibold">Receipt</th>
                  <th className="px-3 py-2 text-center font-semibold">Issued</th>
                  <th className="px-3 py-2 text-center font-semibold">Balance</th>
                  <th className="px-3 py-2 font-semibold">Initials</th>
                  <th className="px-3 py-2 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/60 bg-elevated/50 italic">
                  <td className="px-3 py-1.5" colSpan={2}>Brought forward</td>
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5 text-center">{opening || "—"}</td>
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5 text-center font-semibold">{opening}</td>
                  <td className="px-3 py-1.5" colSpan={2} />
                </tr>
                {b.rows.map((r, i) => {
                  const voucher = [r.voucher_no, r.voucher_date, r.indent_ref ? `Indent ${r.indent_ref}` : null]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr key={i} className="border-b border-line/60">
                      <td className="px-3 py-2 whitespace-nowrap">{String(r.transaction_date ?? "")}</td>
                      <td className="px-3 py-2 text-xs">{voucher || "—"}</td>
                      <td className="px-3 py-2">
                        {String(r.received_from || r.issued_to || "—")}
                        <span className={`ml-1 text-[10px] font-bold ${txnColor[String(r.transaction_type)] ?? "text-muted"}`}>
                          {String(r.transaction_type).replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-semibold text-emerald-600">{num(r.receipt_qty) || ""}</td>
                      <td className="px-3 py-2 text-center font-semibold text-rose-600">{num(r.issue_qty) || ""}</td>
                      <td className="px-3 py-2 text-center font-bold">{num(r.balance_qty)}</td>
                      <td className="px-3 py-2 text-xs">{String(r.receiver_initial ?? "")}</td>
                      <td className="px-3 py-2 text-xs">{String(r.remarks ?? "")}</td>
                    </tr>
                  );
                })}
                <tr className="bg-elevated/50 font-semibold italic">
                  <td className="px-3 py-1.5" colSpan={2}>Carried over</td>
                  <td className="px-3 py-1.5" colSpan={3} />
                  <td className="px-3 py-1.5 text-center">{last}</td>
                  <td className="px-3 py-1.5" colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ Day Book */
async function DayBook({ sp }: { sp: SP }) {
  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to");
  const cond = [sql`dm.display='Y'`];
  if (from && to) cond.push(sql`dm.document_date BETWEEN ${from} AND ${to}`);
  const sbType = one(sp, "sb_type");
  if (sbType) cond.push(sql`sbt.code=${sbType}`);
  const itemType = one(sp, "item_type");
  if (itemType === "CONSUMABLE") cond.push(sql`dit.name ILIKE '%Consumable%'`);
  else if (itemType === "NON_CONSUMABLE") cond.push(sql`dit.name NOT ILIKE '%Consumable%'`);
  const eq = one(sp, "eq_type");
  if (eq === "FURNITURE") cond.push(sql`dic.name ILIKE '%Furniture%'`);
  else if (eq === "ELECTRONIC") cond.push(sql`dic.name ILIKE '%Electronic%'`);
  const txn = one(sp, "txn_type");
  if (txn === "RECEIPT" || txn === "ISSUE") cond.push(sql`di.transaction_type=${txn}`);
  const inst = intParam(sp, "institution_id");
  if (inst) cond.push(sql`dm.institution_id=${inst}`);
  const dept = intParam(sp, "dept_id");
  if (dept) cond.push(sql`dm.department_id=${dept}`);

  const result = (await db.execute(sql`
    SELECT dm.id, dm.page_no,
           to_char(dm.document_date,'DD Mon YYYY') AS document_date,
           dm.receipt_order_no, dm.invoice_ref, dm.indent_no, dm.issued_to, dm.remarks,
           sp.provider_name,
           u.full_name AS verifier_name,
           di.sl_no, di.transaction_type, di.item_description,
           di.receipt_qty_number, di.issue_qty_number, di.balance_qty_number,
           di.receipt_amount_rs, di.issue_amount_rs, di.balance_amount_rs,
           imt.item_name, dic.name AS item_category
    FROM daybook_master_t dm
    LEFT JOIN stockbook_type_t sbt ON sbt.id = dm.stockbook_type_id
    LEFT JOIN daybook_item_t di ON di.daybook_id = dm.id
    LEFT JOIN item_master_t imt ON imt.id = di.item_id
    LEFT JOIN daybook_item_category_t dic ON dic.id = di.item_category_id
    LEFT JOIN daybook_item_type_t dit ON dit.id = di.item_type_id
    LEFT JOIN service_providers_t sp ON sp.id = dm.service_provider_id
    LEFT JOIN users_t u ON u.id = dm.verifier_id
    WHERE ${sql.join(cond, sql` AND `)}
    ORDER BY dm.document_date ASC, dm.page_no ASC, di.sl_no ASC
  `)) as unknown as Record<string, unknown>[];

  if (result.length === 0) return <NoData />;

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm" style={{ minWidth: "60rem" }}>
        <thead>
          <tr className="border-b border-line bg-elevated text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="px-3 py-2 font-semibold">Date</th>
            <th className="px-3 py-2 font-semibold">By whom / To whom</th>
            <th className="px-3 py-2 font-semibold">Order / Invoice</th>
            <th className="px-3 py-2 font-semibold">Item</th>
            <th className="px-3 py-2 text-center font-semibold">Receipt</th>
            <th className="px-3 py-2 text-center font-semibold">Issue</th>
            <th className="px-3 py-2 text-center font-semibold">Balance</th>
            <th className="px-3 py-2 text-right font-semibold">Value (Rs)</th>
            <th className="px-3 py-2 font-semibold">Verifier</th>
            <th className="px-3 py-2 font-semibold">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {result.map((r, i) => {
            const isReceipt = String(r.transaction_type) === "RECEIPT";
            const order = [r.receipt_order_no, r.invoice_ref, r.indent_no ? `Indent ${r.indent_no}` : null]
              .filter(Boolean)
              .join(" · ");
            return (
              <tr key={i} className="border-b border-line/60">
                <td className="px-3 py-2 whitespace-nowrap">{String(r.document_date ?? "")}</td>
                <td className="px-3 py-2">
                  {String(r.provider_name || "—")}
                  {r.issued_to ? <div className="text-xs text-faint">To: {String(r.issued_to)}</div> : null}
                </td>
                <td className="px-3 py-2 text-xs">{order || "—"}</td>
                <td className="px-3 py-2">
                  <span className="font-medium text-fg">{String(r.item_name || r.item_description || "—")}</span>
                  {r.item_category ? <div className="text-xs text-faint">{String(r.item_category)}</div> : null}
                </td>
                <td className="px-3 py-2 text-center text-emerald-600">{isReceipt ? num(r.receipt_qty_number) || "" : ""}</td>
                <td className="px-3 py-2 text-center text-rose-600">{!isReceipt ? num(r.issue_qty_number) || "" : ""}</td>
                <td className="px-3 py-2 text-center font-semibold">{num(r.balance_qty_number)}</td>
                <td className="px-3 py-2 text-right">
                  {isReceipt ? num(r.receipt_amount_rs) : num(r.issue_amount_rs) || num(r.balance_amount_rs)}
                </td>
                <td className="px-3 py-2 text-xs">{String(r.verifier_name ?? "")}</td>
                <td className="px-3 py-2 text-xs">{String(r.remarks ?? "")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NoData() {
  return (
    <div className="rounded-lg border border-dashed border-line py-12 text-center text-sm text-faint">
      No records found for the selected filters.
    </div>
  );
}
