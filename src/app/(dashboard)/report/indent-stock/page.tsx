import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import FilterBar, { type FilterField } from "../_components/filter-bar";
import { ReportHeader, StatCard } from "../_components/report-ui";
import {
  getReportOptions,
  resolveInstDept,
  intListParam,
  pickParam,
  DIRECTIONS,
  dateParam,
  one,
  periodLabel,
  type SP,
} from "../_components/report-data";

/**
 * Indent → Stock mapping.
 *
 * One row per indent line, showing whether it ever reached a stock register
 * and where the article ended up. A line can reach stock two ways: the register
 * picked on the indent line itself, or a stock transaction posted against that
 * line — the second is how the migrated data links the two, so both are read
 * and the line's own choice wins when both exist.
 *
 * Lines with neither read "No Entry", which is the point of the report: it is
 * the list of what has been indented but never entered in a stock book.
 */

/** Sort keys — the key only picks a fragment, it never reaches the SQL. */
const SORTS = {
  group: { label: "Group / item", col: sql`group_name` },
  item: { label: "Item name", col: sql`item_name` },
  indent_date: { label: "Indent date", col: sql`indent_date` },
  indent_no: { label: "Indent no", col: sql`lpad(indent_no, 12, '0')` },
  qty: { label: "Quantity", col: sql`qty` },
  stock_book: { label: "Stock book", col: sql`stock_book_name` },
} as const;

/** #, Item, Qty, Indent (book / no / date), Stock Book (name / book no / page), Location. */
const COL_WIDTHS = ["4%", "26%", "6%", "23%", "27%", "14%"];

const MAPPING = [
  { value: "all", label: "All lines" },
  { value: "mapped", label: "Entered in a stock book" },
  { value: "unmapped", label: "No entry yet" },
] as const;

const inList = (col: ReturnType<typeof sql>, values: (string | number)[]) =>
  sql`${col} IN (${sql.join(values.map((v) => sql`${v}`), sql`, `)})`;

type Row = {
  group_name: string;
  item_name: string;
  qty: number;
  indent_no: string;
  indent_date: string | null;
  indent_book: string | null;
  stock_book_name: string | null;
  stock_book_no: number | null;
  stock_book_page_no: number | null;
  location: string | null;
  mapped: boolean;
};

export default async function IndentStockPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to");
  const bookIds = intListParam(sp, "indent_book");
  const deptIds = intListParam(sp, "dept_id");
  const groupIds = intListParam(sp, "group_id");
  const categoryIds = intListParam(sp, "category");
  const stockBookIds = intListParam(sp, "stock_book");
  const mapping = pickParam(sp, "mapping", ["all", "mapped", "unmapped"] as const, "all");
  const sortKey = pickParam(
    sp,
    "sort",
    Object.keys(SORTS) as (keyof typeof SORTS)[],
    "group"
  );
  const dir = pickParam(sp, "dir", ["asc", "desc"] as const, "asc");
  const orderBy = dir === "desc" ? sql`${SORTS[sortKey].col} DESC` : sql`${SORTS[sortKey].col} ASC`;

  const [
    { departments, indentBooks, stockBooks, itemCategories, itemGroups },
    { institution, department },
  ] = await Promise.all([getReportOptions(), resolveInstDept(sp)]);

  const fields: FilterField[] = [
    { key: "indent_book", label: "Indent Book", type: "select", multi: true, options: indentBooks, placeholder: "All Indent Books" },
    { key: "dept_id", label: "Department", type: "select", multi: true, options: departments, placeholder: "All Departments" },
    { key: "group_id", label: "Item Group", type: "select", multi: true, options: itemGroups, placeholder: "All Groups" },
    { key: "category", label: "Item Category", type: "select", multi: true, options: itemCategories, placeholder: "All Categories" },
    { key: "stock_book", label: "Stock Book", type: "select", multi: true, options: stockBooks, placeholder: "All Stock Books" },
    { key: "mapping", label: "Stock Entry", type: "select", options: [...MAPPING] },
    { key: "from", label: "From Date", type: "date" },
    { key: "to", label: "To Date", type: "date" },
    { key: "sort", label: "Sort By", type: "select", options: Object.entries(SORTS).map(([value, v]) => ({ value, label: v.label })) },
    { key: "dir", label: "Order", type: "select", options: [...DIRECTIONS] },
  ];

  const cond = [sql`ii.display = 'Y'`, sql`idm.display = 'Y'`];
  if (from && to) cond.push(sql`idm.indent_date BETWEEN ${from} AND ${to}`);
  if (bookIds.length) cond.push(inList(sql`idm.book_no`, bookIds));
  if (deptIds.length) cond.push(inList(sql`idm.department_id`, deptIds));
  if (groupIds.length) cond.push(inList(sql`im.group_id`, groupIds));
  if (categoryIds.length) cond.push(inList(sql`im.category_id`, categoryIds));

  const result = (await db.execute(sql`
    SELECT * FROM (
      SELECT
        COALESCE(gm.group_name, 'Ungrouped') AS group_name,
        COALESCE(im.item_name, 'Item ' || ii.item_id) AS item_name,
        COALESCE(ii.qty_intended, 0) AS qty,
        idm.indent_no,
        idm.indent_date,
        ib.book_name AS indent_book,
        -- The register chosen on the line wins; otherwise the one recorded on a
        -- transaction posted against it.
        COALESCE(own.book_name, viaTxn.book_name) AS stock_book_name,
        COALESCE(own.book_no, viaTxn.book_no) AS stock_book_no,
        COALESCE(ii.stock_book_page_no, viaTxn.page_no) AS stock_book_page_no,
        COALESCE(own.id, viaTxn.book_id) AS stock_book_id,
        viaTxn.location,
        (own.id IS NOT NULL OR viaTxn.txn_id IS NOT NULL) AS mapped
      FROM indent_item_t ii
      JOIN indent_master_t idm ON idm.id = ii.indent_id
      LEFT JOIN indent_book_t ib ON ib.id = idm.book_no
      LEFT JOIN item_master_t im ON im.id = ii.item_id
      LEFT JOIN group_item_name_master_t gm ON gm.id = im.group_id
      LEFT JOIN stock_book_master_t own ON own.id = ii.stock_book_master_id
      LEFT JOIN LATERAL (
        SELECT st.id AS txn_id, sbm.id AS book_id, sbm.book_name, sbm.book_no,
               st.stock_book_page_no AS page_no,
               COALESCE(l.location_name, sb.location) AS location
        FROM stock_transaction_t st
        LEFT JOIN stock_book_t sb ON sb.id = st.stock_book_id
        LEFT JOIN issued_to_master_t l ON l.id = sb.location_id
        LEFT JOIN stock_book_master_t sbm ON sbm.id = st.stock_book_master_id
        WHERE st.indent_item_id = ii.id AND st.display = 'Y'
        ORDER BY st.transaction_date DESC, st.id DESC
        LIMIT 1
      ) viaTxn ON true
      WHERE ${sql.join(cond, sql` AND `)}
    ) rows
    WHERE ${
      mapping === "mapped"
        ? sql`mapped`
        : mapping === "unmapped"
          ? sql`NOT mapped`
          : sql`true`
    }
    ${stockBookIds.length ? sql`AND ${inList(sql`stock_book_id`, stockBookIds)}` : sql``}
    ORDER BY ${orderBy} NULLS LAST, group_name ASC, item_name ASC, indent_date ASC
  `)) as unknown as Record<string, unknown>[];

  const rows: Row[] = result.map((r) => ({
    group_name: (r.group_name as string) ?? "Ungrouped",
    item_name: (r.item_name as string) ?? "—",
    qty: Number(r.qty ?? 0),
    indent_no: (r.indent_no as string) ?? "—",
    indent_date: r.indent_date ? String(r.indent_date) : null,
    indent_book: (r.indent_book as string) ?? null,
    stock_book_name: (r.stock_book_name as string) ?? null,
    stock_book_no: r.stock_book_no === null || r.stock_book_no === undefined ? null : Number(r.stock_book_no),
    stock_book_page_no:
      r.stock_book_page_no === null || r.stock_book_page_no === undefined
        ? null
        : Number(r.stock_book_page_no),
    location: (r.location as string) ?? null,
    mapped: Boolean(r.mapped),
  }));

  const totals = rows.reduce(
    (a, r) => ({
      qty: a.qty + r.qty,
      mapped: a.mapped + (r.mapped ? 1 : 0),
      unmapped: a.unmapped + (r.mapped ? 0 : 1),
    }),
    { qty: 0, mapped: 0, unmapped: 0 }
  );
  const groupCount = new Set(rows.map((r) => r.group_name)).size;

  // Group headings with a subtotal under each, then one grand total.
  const cells: React.ReactNode[] = [];
  let group = "";
  let sub = { lines: 0, qty: 0 };
  const flush = (name: string) => {
    cells.push(
      <tr
        key={`sub-${cells.length}`}
        className="border-b border-line bg-sky-500/10 font-semibold text-sky-700 print-avoid-break"
      >
        <td colSpan={2} className="px-3 py-1.5 text-right">
          Subtotal · {name}
        </td>
        <td className="px-3 py-1.5 text-center tabular-nums">{sub.qty}</td>
        <td colSpan={3} className="whitespace-nowrap px-3 py-1.5 font-normal text-muted">
          {sub.lines} {sub.lines === 1 ? "line" : "lines"}
        </td>
      </tr>
    );
    sub = { lines: 0, qty: 0 };
  };

  rows.forEach((r, i) => {
    if (group !== r.group_name) {
      if (group) flush(group);
      group = r.group_name;
      cells.push(
        <tr key={`g-${i}`} className="bg-elevated text-fg print-avoid-break">
          <td colSpan={COL_WIDTHS.length} className="border-y border-line px-3 py-2">
            <span className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide">
              <span className="inline-block h-3.5 w-1 rounded-full bg-accent" aria-hidden />
              {group}
            </span>
          </td>
        </tr>
      );
    }
    cells.push(
      <tr key={`r-${i}`} className="border-b border-line/60 align-top">
        <td className="px-3 py-2 text-center tabular-nums text-faint">{i + 1}</td>
        <td className="px-3 py-2 font-medium text-fg">{r.item_name}</td>
        <td className="px-3 py-2 text-center tabular-nums">{r.qty}</td>
        <td className="px-3 py-2">
          <span className="block text-fg">{r.indent_book ?? "—"}</span>
          <span className="block text-xs tabular-nums text-muted">
            No: {r.indent_no} · {r.indent_date ? formatDate(r.indent_date) : "—"}
          </span>
        </td>
        <td className="px-3 py-2">
          {r.stock_book_name ? (
            <>
              <span className="block text-fg">{r.stock_book_name}</span>
              {(r.stock_book_no !== null || r.stock_book_page_no) && (
                <span className="block text-xs tabular-nums text-muted">
                  {[
                    r.stock_book_no !== null && `Book No: ${r.stock_book_no}`,
                    r.stock_book_page_no && `Page No: ${r.stock_book_page_no}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </>
          ) : r.mapped ? (
            <span className="text-muted">In stock · book not recorded</span>
          ) : (
            <span className="font-semibold text-amber-600">No Entry</span>
          )}
        </td>
        <td className="px-3 py-2 text-muted">{r.location ?? "—"}</td>
      </tr>
    );
    sub.lines += 1;
    sub.qty += r.qty;
    if (i === rows.length - 1) flush(group);
  });

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-fg">Indent → Stock Mapping</h1>
          <p className="text-sm text-muted">
            Which indented articles reached a stock book, and which are still unentered
          </p>
        </div>
      </div>

      <FilterBar fields={fields} />

      <Card className="p-5">
        {/* Six wide columns still read better on a landscape sheet. */}
        <div className="printable print-landscape">
          <ReportHeader
            title="Indent to Stock Mapping"
            institution={institution}
            department={department}
            period={periodLabel(from, to)}
          />

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Item Groups" value={groupCount} grad="grad-violet" />
            <StatCard label="Lines" value={rows.length} grad="grad-blue" />
            <StatCard label="Quantity" value={totals.qty} grad="grad-green" />
            <StatCard label="No Entry" value={totals.unmapped} grad="grad-amber" />
          </div>

          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full table-fixed text-sm" style={{ minWidth: "62rem" }}>
              {/* Fixed widths so the columns line up down the whole report and,
                  on paper, the table fits the sheet instead of running off it. */}
              <colgroup>
                {COL_WIDTHS.map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b-2 border-line bg-elevated text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 text-center font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Item Name</th>
                  <th className="px-3 py-2 text-center font-semibold">Qty</th>
                  <th className="px-3 py-2 font-semibold">Indent Book / No / Date</th>
                  <th className="px-3 py-2 font-semibold">Stock Book / Book No / Page</th>
                  <th className="px-3 py-2 font-semibold">Location</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={COL_WIDTHS.length} className="px-3 py-8 text-center text-faint">
                      No indent lines match these filters.
                    </td>
                  </tr>
                ) : (
                  cells
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-line bg-elevated font-bold text-fg">
                    <td colSpan={2} className="px-3 py-2 text-right">
                      GRAND TOTAL
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">{totals.qty}</td>
                    <td colSpan={3} className="whitespace-nowrap px-3 py-2 font-normal text-muted">
                      {rows.length} lines · {totals.mapped} in stock · {totals.unmapped} with no
                      entry
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
