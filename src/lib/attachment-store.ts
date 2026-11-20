import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { attachmentT } from "@/db/schema";
import { EXT_FOR, MAX_UPLOAD_BYTES, safeFilename, sniffType } from "@/lib/upload";
import type { Category, OwnerType } from "@/lib/attachment";

/**
 * Server-only storage for attachment_t files, shared by /api/attachment and
 * chat. Files live outside /public and are streamed back through
 * /api/attachment, so they are only reachable with a session.
 */
export const UPLOAD_DIR = path.join(process.cwd(), "uploads", "attachment");

export type PreparedFile = { label: string; bytes: Buffer; type: string };

/**
 * Read and validate uploads before anything is written, so a caller can
 * refuse the whole request when nothing is usable. The type is sniffed from
 * the bytes; `sniff` widens what is accepted (chat takes office documents).
 */
export async function prepareUploads(
  files: File[],
  sniff: (bytes: Buffer, name: string) => string | null = (b) => sniffType(b),
  kind = "a genuine image or PDF"
) {
  const ok: PreparedFile[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    const label = safeFilename(file.name);
    if (file.size > MAX_UPLOAD_BYTES) {
      rejected.push(`${label} (larger than 10 MB)`);
      continue;
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > MAX_UPLOAD_BYTES) {
      rejected.push(`${label} (larger than 10 MB)`);
      continue;
    }
    const type = sniff(bytes, label);
    if (!type) rejected.push(`${label} (not ${kind})`);
    else ok.push({ label, bytes, type });
  }
  return { ok, rejected };
}

/** Write prepared files to disk and record them against an owner. */
export async function storeUploads(
  files: PreparedFile[],
  owner: { ownerType: OwnerType; ownerId: number; category: Category; title?: string | null; userId: number }
) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const stamp = Date.now();
  for (const [i, f] of files.entries()) {
    const filename = `${owner.ownerType.toLowerCase()}-${owner.ownerId}-${stamp}-${i}${EXT_FOR[f.type] ?? ""}`;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), new Uint8Array(f.bytes));
    await db.insert(attachmentT).values({
      owner_type: owner.ownerType,
      owner_id: owner.ownerId,
      category: owner.category,
      title: owner.title ?? null,
      file_path: filename,
      file_name: f.label,
      file_type: f.type,
      file_size: f.bytes.length,
      uploaded_by: owner.userId,
      display: "Y",
    });
  }
}

export async function removeStoredFile(name: string | null | undefined) {
  if (!name) return;
  try {
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(name)));
  } catch {
    /* already gone — ignore */
  }
}

export const readStoredFile = (name: string) => fs.readFile(path.join(UPLOAD_DIR, path.basename(name)));
