import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * GET /api/health
 * Confirms the app is up AND that the database is reachable.
 * Returns 200 { status:"ok", db:"connected" } or 503 with details.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const startedAt = Date.now();
        try {
          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!url || !key) {
            return Response.json(
              { status: "degraded", db: "unconfigured", error: "Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY" },
              { status: 503 },
            );
          }

          const supabase = createClient<Database>(url, key, {
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          });

          // Cheapest possible round-trip that also verifies RLS + PostgREST are alive.
          const { error } = await supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .limit(1);

          if (error) {
            return Response.json(
              { status: "degraded", db: "error", error: error.message },
              { status: 503 },
            );
          }

          return Response.json({
            status: "ok",
            db: "connected",
            latency_ms: Date.now() - startedAt,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json(
            { status: "degraded", db: "unreachable", error: message },
            { status: 503 },
          );
        }
      },
    },
  },
});
