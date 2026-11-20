import { NextResponse, type NextRequest } from "next/server";
import { authorise, reply } from "@/lib/income-tax-api";
import { PdfError, extractPdfText, toLines } from "@/lib/pdf-text";
import { parseSlip, type ParsedSlip } from "@/lib/salary-slip";
import { MAX_UPLOAD_BYTES, safeFilename } from "@/lib/upload";

/**
 * Read SPARK salary slip PDFs and return their figures. Nothing is stored
 * here — the editor merges the result, and the files are attached to the
 * statement once it is saved.
 */
const MAX_FILES = 24;

export async function POST(req: NextRequest) {
  const session = await authorise("view", "income tax statements");
  if (session instanceof NextResponse) return session;

  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("file") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return reply(400, "Choose one or more salary slip PDFs.");
  if (files.length > MAX_FILES) return reply(400, `Upload at most ${MAX_FILES} slips at a time.`);

  // `index` is the file's position in the upload, so the client can attach
  // exactly the files that were read.
  const slips: (ParsedSlip & { file: string; index: number })[] = [];
  const errors: { file: string; message: string }[] = [];

  for (const [index, file] of files.entries()) {
    const name = safeFilename(file.name);
    if (file.size > MAX_UPLOAD_BYTES) {
      errors.push({ file: name, message: "Larger than 10 MB." });
      continue;
    }
    try {
      const parsed = parseSlip(toLines(extractPdfText(Buffer.from(await file.arrayBuffer()))));
      if (typeof parsed === "string") errors.push({ file: name, message: parsed });
      else slips.push({ ...parsed, file: name, index });
    } catch (e) {
      if (!(e instanceof PdfError)) console.error("income-tax slips", name, e);
      errors.push({ file: name, message: e instanceof PdfError ? e.message : "Could not read this PDF." });
    }
  }

  slips.sort((a, b) => a.year - b.year || a.month - b.month);
  const message =
    slips.length === 0
      ? "None of the files could be read as a salary slip."
      : `Read ${slips.length} slip${slips.length === 1 ? "" : "s"}${errors.length ? `, ${errors.length} could not be read` : ""}.`;
  return reply(slips.length ? 200 : 422, message, { slips, errors });
}
