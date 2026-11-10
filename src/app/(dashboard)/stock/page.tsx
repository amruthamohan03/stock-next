import StockTable from "./stock-table";
import { getStockOptions } from "./options";
import { getStockRows } from "./list";
import StockForm from "./stock-form";

export default async function StockLedgerPage() {
  const [
    { rows },
    { stockBooks, departments, registers, locations, indentBooks, indents, groups },
  ] = await Promise.all([getStockRows(), getStockOptions()]);

  return (
    <div className="space-y-6">
      <StockForm
        stockBooks={stockBooks}
        departments={departments}
        registers={registers}
        locations={locations}
        indentBooks={indentBooks}
        indents={indents}
        groups={groups}
      />
      <StockTable rows={rows} />
    </div>
  );
}
