import { getSession } from "@/lib/session";
import { chatPerms } from "@/lib/chat";
import ChatPage from "./chat-page";

export default async function Page() {
  const session = await getSession();
  const perms = session ? await chatPerms(session.roleId) : null;
  if (!perms?.view)
    return (
      <p className="rounded-xl border border-line bg-card px-5 py-8 text-center text-sm text-muted">
        Your role doesn&apos;t have access to chat. Ask an administrator to enable it on the Role-Menu Mapping screen.
      </p>
    );
  return <ChatPage />;
}
