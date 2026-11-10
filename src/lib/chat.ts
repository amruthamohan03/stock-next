import { sql } from "drizzle-orm";
import { db } from "@/db";

/** The menu entry whose role mapping decides who may chat (menu_master_t.url). */
export const CHAT_MENU_URL = "chat";

/** A user counts as online if the app polled within this window. */
const ONLINE_SECONDS = 45;
/** How much of a conversation each poll returns. */
const THREAD_LIMIT = 100;

export type ChatPerms = { view: boolean; send: boolean; remove: boolean };

const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[];

/**
 * What a role may do in chat, from its mapping on the Chat menu entry:
 * view = open chat and be listed as a contact, add = send, delete = delete
 * own messages. Super Admin (role 1) may do everything, as everywhere else.
 */
export async function chatPerms(roleId: number): Promise<ChatPerms> {
  if (roleId === 1) return { view: true, send: true, remove: true };
  const [r] = await rows<{ v: number; a: number; d: number }>(sql`
    SELECT COALESCE(MAX(rm.can_view), 0) AS v, COALESCE(MAX(rm.can_add), 0) AS a,
           COALESCE(MAX(rm.can_delete), 0) AS d
    FROM role_menu_mapping_t rm
    JOIN menu_master_t m ON m.id = rm.menu_id AND m.url = ${CHAT_MENU_URL} AND m.display = 'Y'
    WHERE rm.role_id = ${roleId}
  `);
  const view = !!r?.v;
  return { view, send: view && !!r?.a, remove: view && !!r?.d };
}

/** Users this user can chat with: active, not themselves, and allowed to use chat. */
const contactFilter = (me: number) => sql`
  u.display = 'Y' AND u.id <> ${me} AND (
    u.role_id = 1 OR EXISTS (
      SELECT 1 FROM role_menu_mapping_t rm
      JOIN menu_master_t m ON m.id = rm.menu_id AND m.url = ${CHAT_MENU_URL} AND m.display = 'Y'
      WHERE rm.role_id = u.role_id AND rm.can_view = 1
    )
  )`;

export type ChatContact = {
  id: number;
  full_name: string;
  role_name: string | null;
  online: boolean;
  last_body: string | null;
  /** "YYYY-MM-DD HH:MM:SS", server-local, like the rest of the app's timestamps. */
  last_at: string | null;
  last_mine: boolean | null;
  unread: number;
};

/** Contacts with their latest message and unread count, most recent conversation first. */
export async function contactsFor(me: number) {
  return rows<ChatContact>(sql`
    SELECT u.id, u.full_name, r.role_name,
           COALESCE(p.last_seen_at > now() - make_interval(secs => ${ONLINE_SECONDS}), false) AS online,
           lm.body AS last_body,
           to_char(lm.created_at, 'YYYY-MM-DD HH24:MI:SS') AS last_at,
           lm.sender_id = ${me} AS last_mine,
           (SELECT COUNT(*)::int FROM chat_message_t m
             WHERE m.sender_id = u.id AND m.recipient_id = ${me}
               AND m.read_at IS NULL AND m.display = 'Y') AS unread
    FROM users_t u
    LEFT JOIN role_master_t r ON r.id = u.role_id
    LEFT JOIN chat_presence_t p ON p.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT m.body, m.created_at, m.sender_id FROM chat_message_t m
      WHERE m.display = 'Y'
        AND ((m.sender_id = ${me} AND m.recipient_id = u.id)
          OR (m.sender_id = u.id AND m.recipient_id = ${me}))
      ORDER BY m.id DESC LIMIT 1
    ) lm ON true
    WHERE ${contactFilter(me)}
    ORDER BY lm.created_at DESC NULLS LAST, u.full_name
  `);
}

/** True when `other` is someone `me` may message. */
export async function isContact(me: number, other: number) {
  const [r] = await rows<{ ok: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM users_t u WHERE u.id = ${other} AND ${contactFilter(me)}) AS ok
  `);
  return !!r?.ok;
}

export type ChatMessage = {
  id: number;
  sender_id: number;
  body: string;
  created_at: string;
  read: boolean;
};

/**
 * The latest messages between two users, oldest first. Each poll returns the
 * whole window, so deletions and read receipts show up without extra state.
 */
export async function threadBetween(me: number, other: number) {
  const list = await rows<ChatMessage>(sql`
    SELECT id, sender_id, body, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
           read_at IS NOT NULL AS read
    FROM chat_message_t
    WHERE display = 'Y'
      AND ((sender_id = ${me} AND recipient_id = ${other})
        OR (sender_id = ${other} AND recipient_id = ${me}))
    ORDER BY id DESC
    LIMIT ${THREAD_LIMIT}
  `);
  return list.reverse();
}

/** Mark everything `other` sent to `me` as read. */
export async function markRead(me: number, other: number) {
  await db.execute(sql`
    UPDATE chat_message_t SET read_at = now()
    WHERE sender_id = ${other} AND recipient_id = ${me} AND read_at IS NULL AND display = 'Y'
  `);
}

/** Record that the user has the app open (drives the online dot). */
export async function touchPresence(userId: number) {
  await db.execute(sql`
    INSERT INTO chat_presence_t (user_id, last_seen_at) VALUES (${userId}, now())
    ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now()
  `);
}
