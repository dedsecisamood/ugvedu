/** Avatar + name + student ID with Profile / Sign out dropdown. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

interface Profile { full_name: string | null; student_id: string | null; photo_url: string | null }

async function fetchMe(): Promise<Profile | null> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("profiles")
    .select("full_name, student_id, photo_url")
    .eq("id", uid).maybeSingle();
  if (!data) return null;
  let signed: string | null = null;
  if (data.photo_url) {
    const { data: s } = await supabase.storage.from("avatars").createSignedUrl(data.photo_url, 3600);
    signed = s?.signedUrl ?? null;
  }
  return { ...(data as Profile), photo_url: signed };
}

export function UserMenu() {
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (data?.full_name ?? "?")
    .split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="min-h-11 gap-3 px-2"
          aria-label="Open account menu"
        >
          <Avatar className="size-9">
            {data?.photo_url && <AvatarImage src={data.photo_url} alt="" />}
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 text-left sm:block">
            {isLoading ? (
              <>
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-1 h-3 w-16" />
              </>
            ) : (
              <>
                <p className="truncate text-sm font-semibold leading-tight text-foreground">
                  {data?.full_name ?? "Student"}
                </p>
                <p className="truncate text-xs leading-tight text-muted-foreground">
                  {data?.student_id ?? "—"}
                </p>
              </>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile"><UserRound className="mr-2 size-4" aria-hidden />Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 size-4" aria-hidden />Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
