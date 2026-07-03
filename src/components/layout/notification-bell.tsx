/**
 * Notification bell with unread badge. Reads through the browser Supabase
 * client (RLS scopes to own rows), so a network/API failure surfaces as a
 * graceful error tooltip rather than a crash.
 */
import { Bell, AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 60_000,
    retry: 1,
  });
  const unread = data?.filter((n) => !n.is_read).length ?? 0;

  async function markAllRead() {
    if (!data?.length) return;
    const ids = data.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          className="relative min-h-11 min-w-11"
        >
          <Bell className="size-5" aria-hidden />
          {unread > 0 && (
            <span
              className="absolute right-1.5 top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
              aria-hidden
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs font-medium text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading && (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        )}
        {isError && (
          <div className="flex items-start gap-2 p-3 text-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <div>
              <p>Couldn't load notifications.</p>
              <button
                onClick={() => refetch()}
                className="mt-1 text-xs font-medium text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {!isLoading && !isError && data?.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            You're all caught up.
          </p>
        )}
        {!isLoading && !isError && data?.slice(0, 8).map((n) => (
          <DropdownMenuItem key={n.id} className="flex-col items-start gap-1 py-2">
            <div className="flex w-full items-start gap-2">
              <span
                className={cn(
                  "mt-1 size-2 shrink-0 rounded-full",
                  n.is_read ? "bg-transparent" : "bg-primary",
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
