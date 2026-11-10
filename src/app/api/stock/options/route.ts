import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStockOptions } from "@/app/(dashboard)/stock/options";

/**
 * Everything the stock entry form needs to fill its dropdowns — items, groups,
 * stock books, registers, departments, locations, indent books and indents.
 *
 * The same loader the web form uses, so the two can't offer different choices.
 * The mobile app fetches this once per session and caches it.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ success: true, message: "", ...(await getStockOptions()) });
}
