/**
 * GET  /api/notifications        — caller's notifications (recent first)
 * PATCH /api/notifications/:id   — mark as read
 * PATCH /api/notifications       — { ids: [] } bulk mark read; or { all: true }
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, jsonError, readJson } from "@/lib/api-http";

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).max(500).optional(),
  all: z.boolean().optional(),
});

export const Route = createFileRoute("/api/notifications/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        const { data, error } = await ctx.supabase
          .from("notifications")
          .select("id, title, body, is_read, created_at")
          .eq("user_id", ctx.userId)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return jsonError(500, error.message);
        const unread = (data ?? []).filter((n) => !n.is_read).length;
        return Response.json({ data, unread });
      },
      PATCH: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        const parsed = bulkSchema.safeParse(await readJson(request));
        if (!parsed.success) return jsonError(400, "Invalid body", { issues: parsed.error.issues });
        let q = ctx.supabase.from("notifications").update({ is_read: true }).eq("user_id", ctx.userId);
        if (parsed.data.ids?.length) q = q.in("id", parsed.data.ids);
        else if (!parsed.data.all) return jsonError(400, "Provide ids or all=true");
        const { error } = await q;
        if (error) return jsonError(500, error.message);
        return Response.json({ ok: true });
      },
    },
  },
});
