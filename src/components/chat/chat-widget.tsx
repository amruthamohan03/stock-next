"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Maximize2, MessageCircle, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import ChatPanel, { useChatOverview } from "./chat-panel";

/** Poll gently for the badge while closed, briskly while chatting. */
const CLOSED_POLL_MS = 15000;
const OPEN_POLL_MS = 4000;

/**
 * Floating chat button in the bottom-right corner of every page, for roles
 * with access to the Chat menu. Shows an unread badge, announces new messages
 * with a toast, and opens a compact chat panel.
 */
export default function ChatWidget() {
  const pathname = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const { data, error, refresh } = useChatOverview(open ? OPEN_POLL_MS : CLOSED_POLL_MS);
  const seenUnread = useRef<Map<number, number> | null>(null);

  // Toast for messages that arrive while the panel is closed.
  useEffect(() => {
    if (!data) return;
    const now = new Map(data.contacts.map((c) => [c.id, c.unread]));
    const before = seenUnread.current;
    seenUnread.current = now;
    if (!before || open) return; // first load, or the user is already looking
    for (const c of data.contacts) {
      if (c.unread > (before.get(c.id) ?? 0) && c.last_body)
        toast.info(`${c.full_name}: ${c.last_body.length > 80 ? `${c.last_body.slice(0, 80)}…` : c.last_body}`);
    }
  }, [data, open, toast]);

  // The full chat page has its own panel.
  if (pathname === "/chat") return null;

  const unread = data?.unread ?? 0;
  return (
    <div className="no-print fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <section
          role="dialog"
          aria-label="Chat"
          className="flex h-[min(34rem,calc(100vh-7rem))] w-[min(23rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl"
        >
          <header className="bg-accent-duo flex items-center gap-2 px-4 py-3 text-white">
            <MessageCircle className="h-5 w-5" />
            <p className="flex-1 text-sm font-bold">Chat</p>
            <Link
              href="/chat"
              onClick={() => setOpen(false)}
              title="Open full chat"
              aria-label="Open full chat"
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
            >
              <Maximize2 className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          {data ? (
            <ChatPanel overview={data} refresh={refresh} layout="compact" />
          ) : (
            <p className="flex flex-1 items-center justify-center gap-2 text-sm text-faint">
              {error ?? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </>
              )}
            </p>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close chat" : unread ? `Open chat, ${unread} unread` : "Open chat"}
        title="Chat"
        className="bg-accent-duo relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl shadow-accent/40 ring-4 ring-accent/15 transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white ring-2 ring-card">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}
