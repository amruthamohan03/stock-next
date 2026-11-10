import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { chatPerms, contactsFor, touchPresence } from "@/lib/chat";

/**
 * Contact list with unread counts, plus what this user may do. Polled by the
 * chat widget, so it also records the user as online.
 */
export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ success: false, message: "Your session has expired. Please sign in again." }, { status: 401 });
  const perms = await chatPerms(session.roleId);
  if (!perms.view)
    return NextResponse.json({ success: false, message: "Your role doesn't have access to chat." }, { status: 403 });

  const [contacts] = await Promise.all([contactsFor(session.id), touchPresence(session.id)]);
  const unread = contacts.reduce((n, c) => n + c.unread, 0);
  return NextResponse.json({ success: true, message: "", me: session.id, perms, unread, contacts });
}
