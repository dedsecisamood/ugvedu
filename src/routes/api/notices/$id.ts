/** PATCH /api/notices/:id, DELETE (soft), POST /api/notices/:id/read via query action=read. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, jsonError, readJson } from "@/lib/api-http";
import { writeAudit, requireRole } from "@/lib/audit";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(10_000).optional(),
  is_pinned: z.boolean().optional(),
});

async function canManage(ctx: { supabase: Awaited<ReturnType<typeof authenticate>>; userId: string }, noticeId: string) {
  const supabase = (ctx.supabase as { supabase: unknown; userId: string }).supabase ?? ctx.supabase;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = supabase;
  const isAdmin = await requireRole(c, ctx.userId, ["admin"]);
  if (isAdmin) return true;
  const isHead = await requireRole(c, ctx.userId, ["department_head"]);
  if (!isHead) return false;
  const { data: n } = await c.from("notices").select("target_department_id").eq("id", noticeId).maybeSingle();
  if (!n?.target_department_id) return false;
  const { data: prof } = await c.from("profiles").select("department").eq("id", ctx.userId).maybeSingle();
  const { data: dept } = await c.from("departments").select("code").eq("id", n.target_department_id).maybeSingle();
  return prof?.department === dept?.code;
}

export const Route = createFileRoute("/api/notices/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        if (!(await canManage({ supabase: ctx.supabase as never, userId: ctx.userId }, params.id))) return jsonError(403, "Forbidden");
        const parsed = patchSchema.safeParse(await readJson(request));
        if (!parsed.success) return jsonError(400, "Invalid body", { issues: parsed.error.issues });
        const { error } = await ctx.supabase.from("notices").update(parsed.data).eq("id", params.id);
        if (error) return jsonError(500, error.message);
        await writeAudit(ctx.supabase, ctx.userId, "notice.update", "notice", params.id, parsed.data);
        return Response.json({ ok: true });
      },
      DELETE: async ({ request, params }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        if (!(await canManage({ supabase: ctx.supabase as never, userId: ctx.userId }, params.id))) return jsonError(403, "Forbidden");
        const { error } = await ctx.supabase.from("notices").update({ deleted_at: new Date().toISOString() }).eq("id", params.id);
        if (error) return jsonError(500, error.message);
        await writeAudit(ctx.supabase, ctx.userId, "notice.delete", "notice", params.id, {});
        return Response.json({ ok: true });
      },
      POST: async ({ request, params }) => {
        // POST /api/notices/:id?action=read — mark as read.
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        const url = new URL(request.url);
        if (url.searchParams.get("action") !== "read") return jsonError(400, "Unknown action");
        const { error } = await ctx.supabase
          .from("notice_reads")
          .upsert({ user_id: ctx.userId, notice_id: params.id }, { onConflict: "user_id,notice_id" });
        if (error) return jsonError(500, error.message);
        return Response.json({ ok: true });
      },
    },
  },
});
