/** PATCH /api/students/:id, DELETE (soft) — admin/registrar. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, jsonError, readJson } from "@/lib/api-http";
import { writeAudit, requireRole } from "@/lib/audit";

const patchSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  department_id: z.string().uuid().optional(),
  program_id: z.string().uuid().optional(),
  current_semester_id: z.string().uuid().optional(),
  status: z.enum(["ACTIVE","PROBATION","GRADUATED","SUSPENDED","DISMISSED"]).optional(),
});

export const Route = createFileRoute("/api/students/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        if (!(await requireRole(ctx.supabase, ctx.userId, ["admin","registrar"])))
          return jsonError(403, "Forbidden");
        const parsed = patchSchema.safeParse(await readJson(request));
        if (!parsed.success) return jsonError(400, "Invalid body", { issues: parsed.error.issues });
        const { error } = await ctx.supabase.from("students").update(parsed.data).eq("user_id", params.id);
        if (error) return jsonError(500, error.message);
        await writeAudit(ctx.supabase, ctx.userId, "student.update", "student", params.id, parsed.data);
        return Response.json({ ok: true });
      },
      DELETE: async ({ request, params }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        if (!(await requireRole(ctx.supabase, ctx.userId, ["admin","registrar"])))
          return jsonError(403, "Forbidden");
        const { error } = await ctx.supabase.from("students")
          .update({ deleted_at: new Date().toISOString() }).eq("user_id", params.id);
        if (error) return jsonError(500, error.message);
        await writeAudit(ctx.supabase, ctx.userId, "student.delete", "student", params.id, {});
        return Response.json({ ok: true });
      },
    },
  },
});
