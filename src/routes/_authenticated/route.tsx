/**
 * Protected app shell. All routes under `/_authenticated/*` sit inside
 * the sidebar + header layout. SSR is off because Supabase session lives
 * in localStorage.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: ProtectedShell,
});

function ProtectedShell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-dvh bg-background">
        <AppHeader />
        <main role="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
