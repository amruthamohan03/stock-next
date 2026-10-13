import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMenuForRole } from "@/lib/rbac";
import AppSidebar from "@/components/app-sidebar";
import Topbar from "@/components/topbar";
import AppFooter from "@/components/app-footer";
import { getAppSettings } from "@/lib/app-settings-queries";
import { paletteCss } from "@/lib/app-settings";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [menu, settings] = await Promise.all([
    getMenuForRole(session.roleId),
    getAppSettings(),
  ]);

  // Only hex literals survive paletteCss, so nothing but a colour can land in
  // this stylesheet (see the tests around toHexColor).
  const palette = paletteCss(settings);

  // Toasts and confirmations are mounted once here, so every page inside the
  // protected shell can reach them with useToast() / useConfirm().
  return (
    <ToastProvider>
      <ConfirmProvider>
        {palette && <style dangerouslySetInnerHTML={{ __html: palette }} />}
        <div className="flex min-h-screen">
          <AppSidebar menu={menu} settings={settings} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar user={session} />
            <main className="w-full flex-1 overflow-x-hidden p-4 sm:p-5 lg:p-6">
              {children}
            </main>
            <AppFooter settings={settings} />
          </div>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
