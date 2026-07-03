/**
 * GET  /api/students          — list (admin/registrar/dept_head)
 * POST /api/students          — create a student record (admin/registrar only).
 *
 * POST body: {
 *   user_id, student_id, full_name, department_id, program_id?,
 *   admission_semester_id?, current_semester_id?, status?
 * }
 * `user_id` must be an existing auth.users id (create the auth user first via
 * admin API — outside this endpoint's scope).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, jsonError, readJson } from "@/lib/api-http";
import { writeAudit, requireRole } from "@/lib/audit";

const createSchema = z.object({
  user_id: z.string().uuid(),
  student_id: z.string().min(3).max(30),
  full_name: z.string().min(1).max(200),
  department_id: z.string().uuid(),
  program_id: z.string().uuid(),
  admission_semester_id: z.string().uuid(),
  current_semester_id: z.string().uuid().optional(),
  status: z.enum(["ACTIVE","PROBATION","GRADUATED","SUSPENDED","DISMISSED"]).optional(),
});

export const Route = createFileRoute("/api/students/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        if (!(await requireRole(ctx.supabase, ctx.userId, ["admin","registrar","department_head"])))
          return jsonError(403, "Forbidden");
        const { data, error } = await ctx.supabase
          .from("students")
          .select("user_id, student_id, full_name, department_id, program_id, admission_semester_id, current_semester_id, status")
          .is("deleted_at", null).order("student_id").limit(500);
        if (error) return jsonError(500, error.message);
        return Response.json({ data });
      },
      POST: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        if (!(await requireRole(ctx.supabase, ctx.userId, ["admin","registrar"])))
          return jsonError(403, "Forbidden");
        const parsed = createSchema.safeParse(await readJson(request));
        if (!parsed.success) return jsonError(400, "Invalid body", { issues: parsed.error.issues });
        const { data, error } = await ctx.supabase
          .from("students")
          .insert({ ...parsed.data, status: parsed.data.status ?? "ACTIVE" })
          .select("user_id, student_id").single();
        if (error) return jsonError(400, error.message);
        await writeAudit(ctx.supabase, ctx.userId, "student.create", "student", data.user_id, parsed.data);
        return Response.json(data, { status: 201 });
      },
    },
  },
});
