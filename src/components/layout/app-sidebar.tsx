/**
 * Application sidebar. Dark navy, grouped nav, active-route highlighting,
 * icon-only collapsed state on desktop, offcanvas drawer on mobile (< md).
 */
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, UserRound, GraduationCap, CalendarDays, Megaphone,
  FileBarChart2, BookOpen, FolderOpen, ClipboardList, FlaskConical, Wallet,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar";

type NavItem = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Main menu",
    items: [
      { title: "Overview",   url: "/overview", icon: LayoutDashboard },
      { title: "Profile",    url: "/profile",  icon: UserRound },
      { title: "Classes",    url: "/classes",  icon: GraduationCap },
      { title: "Routine",    url: "/routine",  icon: CalendarDays },
      { title: "Notices",    url: "/notices",  icon: Megaphone },
    ],
  },
  {
    label: "Academics",
    items: [
      { title: "Results",          url: "/results",         icon: FileBarChart2 },
      { title: "My Courses",       url: "/my-courses",      icon: BookOpen },
      { title: "Course Materials", url: "/course-materials",icon: FolderOpen },
      { title: "Registrations",    url: "/registrations",   icon: ClipboardList },
      { title: "Lab Projects",     url: "/lab-projects",    icon: FlaskConical },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "My Payments", url: "/payments", icon: Wallet },
    ],
  },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => path === url || path.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon" aria-label="Main navigation">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-gold text-gold-foreground font-bold">
            U
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">UGV Barishal</p>
            <p className="truncate text-xs text-sidebar-foreground/60">Student Portal</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {g.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className="data-[active=true]:bg-gold data-[active=true]:text-gold-foreground data-[active=true]:hover:bg-gold/90"
                    >
                      <Link to={item.url}>
                        <item.icon className="size-4" aria-hidden />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
