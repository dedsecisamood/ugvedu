/**
 * /api/notices
 *   GET  — list notices scoped to the caller (student: dept+semester+global; staff: all)
 *   POST — publish a notice (admin or department_head for own dept)
 *
 * Body (POST): { title, body, target_department_id?, target_semester_id?, is_pinned? }
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, jsonError, readJson } from "@/lib/api-http";
import { writeAudit, requireRole } from "@/lib/audit";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
  target_department_id: z.string().uuid().nullable().optional(),
  target_semester_id: z.string().uuid().nullable().optional(),
  is_pinned: z.boolean().optional(),
});

export const Route = createFileRoute("/api/notices/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;

        // Fetch caller's student profile (if any) to filter.
        const { data: student } = await ctx.supabase
          .from("students")
          .select("department_id, current_semester_id")
          .eq("user_id", ctx.userId)
          .maybeSingle();

        let q = ctx.supabase
          .from("notices")
          .select("id, title, body, target_department_id, target_semester_id, is_pinned, published_at, published_by_user_id, created_at")
          .is("deleted_at", null)
          .order("is_pinned", { ascending: false })
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(100);

        if (student) {
          // Student: own dept OR global; own semester OR global.
          q = q.or(`target_department_id.is.null,target_department_id.eq.${student.department_id}`)
               .or(`target_semester_id.is.null,target_semester_id.eq.${student.current_semester_id ?? "00000000-0000-0000-0000-000000000000"}`);
        }

        const { data, error } = await q;
        if (error) return jsonError(500, error.message);

        // Per-user read status
        const { data: reads } = await ctx.supabase
          .from("notice_reads")
          .select("notice_id")
          .eq("user_id", ctx.userId);
        const readSet = new Set((reads ?? []).map((r) => r.notice_id));
        return Response.json({
          data: (data ?? []).map((n) => ({ ...n, is_read: readSet.has(n.id) })),
        });
      },

      POST: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        const body = await readJson(request);
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) return jsonError(400, "Invalid body", { issues: parsed.error.issues });

        const isAdmin = await requireRole(ctx.supabase, ctx.userId, ["admin"]);
        const isHead = await requireRole(ctx.supabase, ctx.userId, ["department_head"]);
        if (!isAdmin && !isHead) return jsonError(403, "Forbidden");

        // A department head can only target their own department.
        if (!isAdmin && isHead) {
          if (!parsed.data.target_department_id) return jsonError(403, "Department head must target a department");
          const { data: prof } = await ctx.supabase
            .from("profiles").select("department").eq("id", ctx.userId).maybeSingle();
          const { data: dept } = await ctx.supabase
            .from("departments").select("code").eq("id", parsed.data.target_department_id).maybeSingle();
          if (!prof || !dept || prof.department !== dept.code) return jsonError(403, "Not your department");
        }

        const { data: inserted, error } = await ctx.supabase
          .from("notices")
          .insert({
            title: parsed.data.title,
            body: parsed.data.body,
            target_department_id: parsed.data.target_department_id ?? null,
            target_semester_id: parsed.data.target_semester_id ?? null,
            is_pinned: parsed.data.is_pinned ?? false,
            published_by_user_id: ctx.userId,
            published_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) return jsonError(500, error.message);

        await writeAudit(ctx.supabase, ctx.userId, "notice.publish", "notice", inserted.id, parsed.data);
        return Response.json({ id: inserted.id }, { status: 201 });
      },
    },
  },
});
