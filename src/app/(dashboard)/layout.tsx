import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMenuForRole } from "@/lib/rbac";
import AppSidebar from "@/components/app-sidebar";
import Topbar from "@/components/topbar";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const menu = await getMenuForRole(session.roleId);

  // Toasts and confirmations are mounted once here, so every page inside the
  // protected shell can reach them with useToast() / useConfirm().
  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="flex min-h-screen">
          <AppSidebar menu={menu} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar user={session} />
            <main className="w-full flex-1 overflow-x-hidden p-4 sm:p-5 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
