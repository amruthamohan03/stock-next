/**
 * The register an indent line falls back to when a stock-book page number is
 * written down but no book is picked (book 1, "Computer Stock Register").
 * Matched by name so it doesn't depend on the row id of a particular database.
 */
export const DEFAULT_STOCK_BOOK_NAME = "Computer Stock Register";

/** "Name (Book 2, Vol 3)" — the register's name plus the number on its cover. */
export function stockBookLabel(b: { name: string; book_no: number | null; volume: number | null }) {
  return b.book_no
    ? `${b.name} (Book ${b.book_no}${b.volume && b.volume > 1 ? `, Vol ${b.volume}` : ""})`
    : b.name;
}

/** Id of the default register in a list of stock books, if it is there. */
export function defaultStockBookId(books: { id: number; name: string }[]) {
  return books.find((b) => b.name.trim().toLowerCase() === DEFAULT_STOCK_BOOK_NAME.toLowerCase())?.id;
}
