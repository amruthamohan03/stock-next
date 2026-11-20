import { NextResponse, type NextRequest } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { getSession, type SessionUser } from "@/lib/session";
import { ownedBy } from "@/lib/rbac";
import {
  applicationSettingsMasterT,
  attachmentT,
  chatMessageT,
  committeeT,
  eventT,
  fdpT,
  incomeTaxStatementT,
  studyMaterialT,
} from "@/db/schema";
import { isInlineType, safeFilename } from "@/lib/upload";
import { isOwnerType, toCategory, type OwnerType } from "@/lib/attachment";
import { prepareUploads, readStoredFile, removeStoredFile, storeUploads } from "@/lib/attachment-store";

/**
 * Files attached to committees, events, materials, FDPs, settings, income tax
 * statements and chat messages.
 *
 * One POST can carry several files — the panel lets people drop a whole
 * folder of event photos in at once. Files are stored outside /public and
 * streamed through GET, so they are only reachable with an authenticated
 * session, and the content type is sniffed from the bytes rather than
 * trusting the browser.
 */

/** The owning row must exist, not be soft-deleted, and be visible to the user. */
async function ownerExists(ownerType: OwnerType, ownerId: number, user: SessionUser) {
  // Application settings is a singleton with no soft delete, so it has no
  // `display` column and is checked on its own.
  if (ownerType === "SETTINGS") {
    const [row] = await db
      .select({ id: applicationSettingsMasterT.id })
      .from(applicationSettingsMasterT)
      .where(eq(applicationSettingsMasterT.id, ownerId))
      .limit(1);
    return !!row;
  }

  // The rest share the same shape of check; a lookup keeps this honest when
  // another owner type is added.
  const TABLES = {
    COMMITTEE: committeeT,
    EVENT: eventT,
    MATERIAL: studyMaterialT,
    FDP: fdpT,
    INCOME_TAX: incomeTaxStatementT,
    CHAT: chatMessageT,
  } as const;
  const table = TABLES[ownerType];
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(
      and(
        eq(table.id, ownerId),
        eq(table.display, "Y"),
        // Income tax statements are private to whoever created or modified
        // them (Super Admin sees all), and so are the slips filed against them.
        ownerType === "INCOME_TAX" ? ownedBy(user, incomeTaxStatementT) : undefined,
        // A chat file is for the two people in that conversation only.
        ownerType === "CHAT"
          ? or(eq(chatMessageT.sender_id, user.id), eq(chatMessageT.recipient_id, user.id))
          : undefined
      )
    )
    .limit(1);
  return !!row;
}

/** Owner types whose files are private to some users; the rest are open to any session. */
const PRIVATE_OWNERS = new Set<string>(["INCOME_TAX", "CHAT"]);

/** Can this user reach an existing attachment? */
async function canReach(row: { owner_type: string; owner_id: number }, user: SessionUser) {
  return !PRIVATE_OWNERS.has(row.owner_type) || ownerExists(row.owner_type as OwnerType, row.owner_id, user);
}

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });
const NOT_FOUND = () => fail("Attachment not found", 404);
/** Chat files belong to their message: sent with it, and deleted with it. */
const CHAT_ONLY = () => fail("Chat files are sent and deleted from the chat window.", 400);

/** Human label for the "not found" message. */
const OWNER_LABEL: Record<OwnerType, string> = {
  COMMITTEE: "Committee",
  EVENT: "Event",
  MATERIAL: "Study material",
  FDP: "FDP record",
  SETTINGS: "Application settings",
  INCOME_TAX: "Income tax statement",
  CHAT: "Chat message",
};

/** Upload one or more files against an owner. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  const form = await req.formData();
  const ownerTypeRaw = String(form.get("owner_type") ?? "").toUpperCase();
  const ownerId = Number(form.get("owner_id"));
  const category = toCategory(form.get("category"));
  const title = String(form.get("title") ?? "").trim() || null;

  if (!isOwnerType(ownerTypeRaw)) return fail("Unknown owner type", 400);
  const ownerType = ownerTypeRaw as OwnerType;
  if (ownerType === "CHAT") return CHAT_ONLY();

  if (!Number.isInteger(ownerId) || ownerId <= 0) return fail("A valid owner id is required", 400);

  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return fail("No files provided", 400);

  if (!(await ownerExists(ownerType, ownerId, session)))
    return fail(`${OWNER_LABEL[ownerType]} not found`, 404);

  const { ok, rejected } = await prepareUploads(files);
  // A partial upload still succeeded for some files — say exactly which failed
  // rather than reporting a blanket error over a batch that mostly worked.
  if (ok.length === 0) return fail(`Nothing uploaded — ${rejected.join("; ")}`, 400);

  try {
    await storeUploads(ok, { ownerType, ownerId, category, title, userId: session.id });
  } catch (e) {
    return fail((e as Error).message, 500);
  }

  const message =
    rejected.length === 0
      ? `${ok.length} file${ok.length === 1 ? "" : "s"} uploaded`
      : `${ok.length} uploaded, ${rejected.length} skipped — ${rejected.join("; ")}`;
  return NextResponse.json({ success: true, message, saved: ok.length, rejected: rejected.length });
}

/** Stream one attachment: images and PDFs inline, anything else as a download. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return fail("A valid attachment id is required", 400);

  const [row] = await db
    .select()
    .from(attachmentT)
    .where(and(eq(attachmentT.id, id), eq(attachmentT.display, "Y")))
    .limit(1);
  if (!row || !(await canReach(row, session))) return NOT_FOUND();

  try {
    const data = await readStoredFile(row.file_path);
    const disposition = isInlineType(row.file_type) ? "inline" : "attachment";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": row.file_type || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${safeFilename(row.file_name)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return fail("File missing on server", 404);
  }
}

/** Rename or recategorise an attachment. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  const body = (await req.json()) as { id?: number; title?: string; category?: string };
  const id = Number(body.id);
  if (!id) return fail("Attachment id is required", 400);

  const [row] = await db
    .select({ owner_type: attachmentT.owner_type, owner_id: attachmentT.owner_id })
    .from(attachmentT)
    .where(eq(attachmentT.id, id))
    .limit(1);
  if (!row || !(await canReach(row, session))) return NOT_FOUND();
  if (row.owner_type === "CHAT") return CHAT_ONLY();

  try {
    await db
      .update(attachmentT)
      .set({
        title: String(body.title ?? "").trim() || null,
        category: toCategory(body.category),
      })
      .where(eq(attachmentT.id, id));
    return NextResponse.json({ success: true, message: "File updated" });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return fail("A valid attachment id is required", 400);

  const [row] = await db.select().from(attachmentT).where(eq(attachmentT.id, id)).limit(1);
  if (!row || !(await canReach(row, session))) return NOT_FOUND();
  if (row.owner_type === "CHAT") return CHAT_ONLY();

  try {
    // Hard delete here, unlike the masters: the row only points at a file, and
    // leaving orphaned bytes on disk is worse than losing the pointer.
    await removeStoredFile(row.file_path);
    await db.delete(attachmentT).where(eq(attachmentT.id, id));
    return NextResponse.json({ success: true, message: "File removed" });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
