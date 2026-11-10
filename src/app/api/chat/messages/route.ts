import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatMessageT } from "@/db/schema";
import { getSession } from "@/lib/session";
import { chatPerms, isContact, markRead, threadBetween, touchPresence } from "@/lib/chat";

const MAX_CHARS = 2000;

const fail = (message: string, status = 400) =>
  NextResponse.json({ success: false, message }, { status });

const posInt = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** The signed-in user and their chat rights, or a ready error response. */
async function access() {
  const session = await getSession();
  if (!session) return { error: fail("Your session has expired. Please sign in again.", 401) } as const;
  const perms = await chatPerms(session.roleId);
  if (!perms.view) return { error: fail("Your role doesn't have access to chat.", 403) } as const;
  return { session, perms } as const;
}

/** The conversation with one contact. Opening it marks their messages as read. */
export async function GET(req: NextRequest) {
  const a = await access();
  if ("error" in a) return a.error;
  const other = posInt(new URL(req.url).searchParams.get("with"));
  if (!other) return fail("Choose who to chat with.");
  if (!(await isContact(a.session.id, other)))
    return fail("That person isn't available for chat.", 404);

  await Promise.all([markRead(a.session.id, other), touchPresence(a.session.id)]);
  const messages = await threadBetween(a.session.id, other);
  return NextResponse.json({ success: true, message: "", messages });
}

/** Send a message to a contact. */
export async function POST(req: NextRequest) {
  const a = await access();
  if ("error" in a) return a.error;
  if (!a.perms.send) return fail("Your role can read chats but not send messages.", 403);

  const body = (await req.json().catch(() => ({}))) as { to?: unknown; body?: unknown };
  const to = posInt(body.to);
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!to) return fail("Choose who to send the message to.");
  if (!text) return fail("Type a message first.");
  if (text.length > MAX_CHARS) return fail(`Messages can be up to ${MAX_CHARS} characters.`);
  if (!(await isContact(a.session.id, to)))
    return fail("That person isn't available for chat.", 404);

  const [msg] = await db
    .insert(chatMessageT)
    .values({ sender_id: a.session.id, recipient_id: to, body: text })
    .returning({ id: chatMessageT.id });
  return NextResponse.json({ success: true, message: "Sent", id: msg.id });
}

/** Delete one of your own messages (soft delete, kept for history). */
export async function DELETE(req: NextRequest) {
  const a = await access();
  if ("error" in a) return a.error;
  if (!a.perms.remove) return fail("Your role can't delete chat messages.", 403);
  const id = posInt(new URL(req.url).searchParams.get("id"));
  if (!id) return fail("Choose a message to delete.");

  const done = await db
    .update(chatMessageT)
    .set({ display: "N" })
    .where(and(eq(chatMessageT.id, id), eq(chatMessageT.sender_id, a.session.id), eq(chatMessageT.display, "Y")))
    .returning({ id: chatMessageT.id });
  if (done.length === 0) return fail("You can only delete your own messages.", 404);
  return NextResponse.json({ success: true, message: "Message deleted" });
}
