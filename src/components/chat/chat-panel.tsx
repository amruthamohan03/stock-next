"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, Loader2, MessageCircle, Search, Send, Trash2 } from "lucide-react";
import { apiDelete, apiPost, apiRequest } from "@/lib/api-client";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import type { ChatContact, ChatMessage, ChatPerms } from "@/lib/chat";

export type ChatOverview = { me: number; perms: ChatPerms; unread: number; contacts: ChatContact[] };

const THREAD_POLL_MS = 3000;

/** Parse the API's "YYYY-MM-DD HH:MM:SS" (server-local) timestamps. */
const toDate = (s: string) => new Date(s.replace(" ", "T"));
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const timeOf = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const dayLabel = (d: Date) => {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
};
/** Short stamp for the contact list: a time today, else a date. */
const listStamp = (s: string | null) => {
  if (!s) return "";
  const d = toDate(s);
  return sameDay(d, new Date()) ? timeOf(d) : d.toLocaleDateString([], { day: "2-digit", month: "short" });
};
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

function Avatar({ name, online, size = "md" }: { name: string; online: boolean; size?: "sm" | "md" }) {
  return (
    <span className="relative shrink-0">
      <span
        className={`bg-accent-duo flex items-center justify-center rounded-full font-bold text-white ${
          size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-xs"
        }`}
      >
        {initials(name)}
      </span>
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card ${
          online ? "bg-emerald-500" : "bg-slate-400"
        }`}
        aria-label={online ? "Online" : "Offline"}
      />
    </span>
  );
}

/**
 * Polls the contact list (with unread counts) while mounted. Shared by the
 * floating widget and the full chat page.
 */
export function useChatOverview(intervalMs: number) {
  const [data, setData] = useState<ChatOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const r = await apiRequest<ChatOverview & { success: boolean }>("/api/chat");
    if (r.success && r.data) {
      setData(r.data);
      setError(null);
    } else setError(r.message);
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      // Don't poll from a hidden tab; catch up as soon as it is shown again.
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    const onShow = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [intervalMs, refresh]);
  return { data, error, refresh };
}

function ContactList({
  contacts,
  activeId,
  onPick,
}: {
  contacts: ChatContact[];
  activeId: number | null;
  onPick: (c: ChatContact) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? contacts.filter((c) => `${c.full_name} ${c.role_name ?? ""}`.toLowerCase().includes(q))
    : contacts;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative border-b border-line p-3">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          aria-label="Search people"
          className="h-9 w-full rounded-[0.65rem] border border-line bg-elevated pl-9 pr-3 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20"
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {shown.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-faint">
            {contacts.length === 0 ? "No one else has chat access yet." : "No one matches that search."}
          </li>
        )}
        {shown.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-elevated ${
                c.id === activeId ? "bg-accent-soft" : ""
              }`}
            >
              <Avatar name={c.full_name} online={c.online} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-fg">{c.full_name}</span>
                  <span className="shrink-0 text-[11px] text-faint">{listStamp(c.last_at)}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className={`truncate text-xs ${c.unread ? "font-medium text-fg" : "text-muted"}`}>
                    {c.last_body
                      ? `${c.last_mine ? "You: " : ""}${c.last_body}`
                      : (c.role_name ?? "Start a conversation")}
                  </span>
                  {c.unread > 0 && (
                    <span className="bg-accent-duo shrink-0 rounded-full px-1.5 text-[10px] font-bold leading-4 text-white">
                      {c.unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Thread({
  me,
  perms,
  contact,
  onBack,
  onActivity,
}: {
  me: number;
  perms: ChatPerms;
  contact: ChatContact;
  onBack?: () => void;
  /** Called after sending or reading, so the contact list can refresh. */
  onActivity: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastId = useRef(0);

  const load = useCallback(async () => {
    const r = await apiRequest<{ messages?: ChatMessage[] }>(`/api/chat/messages?with=${contact.id}`);
    if (r.success) {
      const list = r.data?.messages ?? [];
      setMessages(list);
      setLoadError(null);
      const newest = list.at(-1)?.id ?? 0;
      // Opening a thread marks it read; let the list drop its badge.
      if (newest !== lastId.current) {
        lastId.current = newest;
        onActivity();
      }
    } else setLoadError(r.message);
  }, [contact.id, onActivity]);

  useEffect(() => {
    setMessages(null);
    lastId.current = 0;
    stickToBottom.current = true;
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), THREAD_POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Follow new messages unless the user has scrolled up to read history.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const r = await apiPost("/api/chat/messages", { to: contact.id, body: text });
    setSending(false);
    if (r.success) {
      setDraft("");
      stickToBottom.current = true;
      await load();
    } else toast.error(r.message);
  };

  const remove = async (m: ChatMessage) => {
    const ok = await confirm({
      title: "Delete this message?",
      description: "It disappears from the conversation for both of you.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    if (toast.fromResult(await apiDelete(`/api/chat/messages?id=${m.id}`))) load();
  };

  // The newest message of mine that the contact has read, for the "Seen" mark.
  const seenId = useMemo(
    () => [...(messages ?? [])].reverse().find((m) => m.sender_id === me && m.read)?.id,
    [messages, me]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to people"
            className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <Avatar name={contact.full_name} online={contact.online} size="sm" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold text-fg">{contact.full_name}</p>
          <p className={`text-xs ${contact.online ? "text-emerald-500" : "text-faint"}`}>
            {contact.online ? "Online" : "Offline"}
            {contact.role_name ? ` · ${contact.role_name}` : ""}
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3 text-sm"
        aria-live="polite"
      >
        {messages === null && !loadError && (
          <p className="flex items-center justify-center gap-2 py-8 text-xs text-faint">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        )}
        {loadError && <p className="py-8 text-center text-sm text-rose-500">{loadError}</p>}
        {messages?.length === 0 && (
          <p className="py-8 text-center text-sm text-faint">
            No messages yet. Say hello to {contact.full_name.split(" ")[0]}.
          </p>
        )}
        {messages?.map((m, i) => {
          const at = toDate(m.created_at);
          const prev = messages[i - 1];
          const newDay = !prev || !sameDay(toDate(prev.created_at), at);
          const mine = m.sender_id === me;
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-2 flex justify-center">
                  <span className="rounded-full bg-elevated px-2.5 py-0.5 text-[11px] font-medium text-faint ring-1 ring-line">
                    {dayLabel(at)}
                  </span>
                </div>
              )}
              <div className={`group flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
                {mine && perms.remove && (
                  <button
                    type="button"
                    onClick={() => remove(m)}
                    title="Delete message"
                    aria-label="Delete message"
                    className="mb-1 rounded p-1 text-faint opacity-0 transition-opacity hover:text-rose-500 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <div
                  className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 ${
                    mine
                      ? "bg-accent-duo rounded-br-md text-white"
                      : "rounded-bl-md bg-elevated text-fg ring-1 ring-line"
                  }`}
                >
                  {m.body}
                  <span
                    className={`ml-2 inline-flex translate-y-0.5 items-center gap-0.5 align-bottom text-[10px] ${
                      mine ? "text-white/70" : "text-faint"
                    }`}
                  >
                    {timeOf(at)}
                    {mine &&
                      (m.read ? (
                        <CheckCheck className="h-3 w-3" aria-label="Read" />
                      ) : (
                        <Check className="h-3 w-3" aria-label="Sent" />
                      ))}
                  </span>
                </div>
              </div>
              {m.id === seenId && <p className="pr-1 pt-0.5 text-right text-[10px] text-faint">Seen</p>}
            </div>
          );
        })}
      </div>

      {perms.send ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 border-t border-line p-3"
        >
          <textarea
            rows={1}
            value={draft}
            maxLength={2000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter starts a new line.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Message ${contact.full_name.split(" ")[0]}…`}
            aria-label="Message"
            className="max-h-28 min-h-9 flex-1 resize-none rounded-[0.65rem] border border-line bg-elevated px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Send"
            className="bg-accent-duo flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md shadow-accent/30 transition-opacity disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      ) : (
        <p className="border-t border-line px-3 py-3 text-center text-xs text-faint">
          Your role can read chats but not send messages.
        </p>
      )}
    </div>
  );
}

/**
 * Contacts and conversation. "compact" shows one at a time (the floating
 * widget); "full" shows them side by side (the /chat page).
 */
export default function ChatPanel({
  overview,
  refresh,
  layout,
}: {
  overview: ChatOverview;
  refresh: () => void;
  layout: "compact" | "full";
}) {
  const [activeId, setActiveId] = useState<number | null>(null);
  // Always read the contact from the latest poll, so online/unread stay current.
  const active = overview.contacts.find((c) => c.id === activeId) ?? null;

  const thread = active ? (
    <Thread
      key={active.id}
      me={overview.me}
      perms={overview.perms}
      contact={active}
      onBack={layout === "compact" ? () => setActiveId(null) : undefined}
      onActivity={refresh}
    />
  ) : null;
  const list = (
    <ContactList contacts={overview.contacts} activeId={activeId} onPick={(c) => setActiveId(c.id)} />
  );

  if (layout === "compact") return thread ?? list;
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-72 shrink-0 flex-col border-r border-line">{list}</div>
      {thread ?? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-faint">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated ring-1 ring-line">
            <MessageCircle className="h-5 w-5" />
          </span>
          Pick someone on the left to start chatting.
        </div>
      )}
    </div>
  );
}
