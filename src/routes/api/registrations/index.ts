/**
 * /api/registrations
 *   GET  — student sees own; admin/registrar/dept_head see all (filter via ?studentUserId)
 *   POST — student requests registration for a course offering.
 *          Body: { course_offering_id }. Server-enforced: caller == student.
 *
 * Race-safety: register_for_offering() runs under SECURITY DEFINER with
 * `SELECT ... FOR UPDATE` on the offering row, so simultaneous requests for
 * the last seat serialize; only one wins.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, jsonError, readJson } from "@/lib/api-http";
import { writeAudit, requireRole } from "@/lib/audit";

const postSchema = z.object({ course_offering_id: z.string().uuid() });

export const Route = createFileRoute("/api/registrations/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        const url = new URL(request.url);
        const filterStudent = url.searchParams.get("studentUserId");

        const isStaff = await requireRole(ctx.supabase, ctx.userId,
          ["admin","registrar","department_head"]);
        const target = isStaff && filterStudent ? filterStudent : ctx.userId;
        if (!isStaff && filterStudent && filterStudent !== ctx.userId) return jsonError(403, "Forbidden");

        const { data, error } = await ctx.supabase
          .from("registrations")
          .select("id, student_user_id, course_offering_id, status, requested_at, decided_at, decided_by_user_id")
          .eq("student_user_id", target)
          .order("requested_at", { ascending: false })
          .limit(200);
        if (error) return jsonError(500, error.message);
        return Response.json({ data });
      },

      POST: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        const parsed = postSchema.safeParse(await readJson(request));
        if (!parsed.success) return jsonError(400, "Invalid body", { issues: parsed.error.issues });

        // Only students register for themselves.
        const { data: student } = await ctx.supabase
          .from("students").select("user_id").eq("user_id", ctx.userId).maybeSingle();
        if (!student) return jsonError(403, "Only students may register");

        const { data, error } = await ctx.supabase.rpc("register_for_offering", {
          _student_user_id: ctx.userId,
          _course_offering_id: parsed.data.course_offering_id,
        });
        if (error) return jsonError(500, error.message);
        const result = data as { ok: boolean; error?: string; registration_id?: string };
        if (!result.ok) return jsonError(409, result.error ?? "Registration failed");

        await writeAudit(ctx.supabase, ctx.userId, "registration.create",
          "registration", result.registration_id ?? "", parsed.data);
        return Response.json({ id: result.registration_id }, { status: 201 });
      },
    },
  },
});
