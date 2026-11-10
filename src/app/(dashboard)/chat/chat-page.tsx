"use client";

import { Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import ChatPanel, { useChatOverview } from "@/components/chat/chat-panel";

/** Full-page chat: people on the left, the conversation on the right. */
export default function ChatPage() {
  const { data, error, refresh } = useChatOverview(4000);
  return (
    <Card className="flex h-[calc(100vh-12rem)] min-h-[28rem] flex-col">
      <CardHeader>
        <div>
          <CardTitle>Chat</CardTitle>
          <span className="text-sm text-faint">
            Message colleagues who have chat access
            {data && data.unread > 0 ? ` · ${data.unread} unread` : ""}
          </span>
        </div>
      </CardHeader>
      {data ? (
        <ChatPanel overview={data} refresh={refresh} layout="full" />
      ) : (
        <p className="flex flex-1 items-center justify-center gap-2 text-sm text-faint">
          {error ?? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </>
          )}
        </p>
      )}
    </Card>
  );
}
