/** Top app header: sidebar trigger, search input, register CTA, bell, user menu. */
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

export function AppHeader() {
  return (
    <header
      role="banner"
      className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6"
    >
      <SidebarTrigger className="min-h-11 min-w-11" />

      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="relative hidden max-w-md flex-1 md:block"
      >
        <label htmlFor="global-search" className="sr-only">Search</label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="global-search"
          type="search"
          placeholder="Search courses, notices, materials…"
          className="pl-9"
        />
      </form>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Button
          asChild
          className="min-h-11 bg-gold text-gold-foreground hover:bg-gold/90 focus-visible:ring-gold"
        >
          <Link to="/registrations">Register</Link>
        </Button>
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
