import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: `Dashboard — ${APP_NAME}` }] }),
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-gold">Signed in</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">Welcome</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>

      <div className="mt-8 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Placeholder dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Auth is wired up. Result, notice, and payment views will land under this
          protected layout in the next iteration.
        </p>
      </div>

      <div className="mt-6 flex gap-3 text-sm">
        <Link to="/" className="text-primary hover:underline">
          Home
        </Link>
        <button onClick={signOut} disabled={busy} className="text-destructive hover:underline">
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
