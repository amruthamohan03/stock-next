import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMenuForRole } from "@/lib/rbac";
import AppSidebar from "@/components/app-sidebar";
import Topbar from "@/components/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const menu = await getMenuForRole(session.roleId);

  return (
    <div className="flex min-h-screen">
      <AppSidebar menu={menu} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={session} />
        <main className="mx-auto w-full max-w-7xl flex-1 overflow-x-hidden p-5 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
