/**
 * GET   /api/grades?courseOfferingId=…  — roster + current draft grade
 * PATCH /api/grades                     — { enrollment_id, letter_grade, is_incomplete? } upsert DRAFT
 *
 * "Draft" = grades row exists with published_at IS NULL; not visible to
 * students and not counted toward any SemesterResult until publish is called.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, jsonError, readJson } from "@/lib/api-http";
import { writeAudit, requireRole } from "@/lib/audit";

const patchSchema = z.object({
  enrollment_id: z.string().uuid(),
  letter_grade: z.string().min(1).max(3),
  is_incomplete: z.boolean().optional(),
});

async function canGradeOffering(supabase: Awaited<ReturnType<typeof authenticate>>, userId: string, offeringId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = supabase;
  if (await requireRole(c, userId, ["admin"])) return true;
  const { data } = await c.from("course_offerings").select("instructor_user_id").eq("id", offeringId).maybeSingle();
  return data?.instructor_user_id === userId;
}

export const Route = createFileRoute("/api/grades/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        const url = new URL(request.url);
        const offeringId = url.searchParams.get("courseOfferingId");
        if (!offeringId) return jsonError(400, "courseOfferingId required");
        if (!(await canGradeOffering(ctx.supabase as never, ctx.userId, offeringId)))
          return jsonError(403, "Forbidden");

        const { data, error } = await ctx.supabase
          .from("enrollments")
          .select("id, student_user_id, status, students!inner(student_id, full_name), grades(letter_grade, is_incomplete, published_at)")
          .eq("course_offering_id", offeringId)
          .neq("status", "DROPPED");
        if (error) return jsonError(500, error.message);
        return Response.json({ data });
      },

      PATCH: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        const parsed = patchSchema.safeParse(await readJson(request));
        if (!parsed.success) return jsonError(400, "Invalid body", { issues: parsed.error.issues });

        // Verify caller can grade this enrollment's offering.
        const { data: enr } = await ctx.supabase
          .from("enrollments").select("course_offering_id")
          .eq("id", parsed.data.enrollment_id).maybeSingle();
        if (!enr) return jsonError(404, "Enrollment not found");
        if (!(await canGradeOffering(ctx.supabase as never, ctx.userId, enr.course_offering_id)))
          return jsonError(403, "Forbidden");

        // Lookup grade point + is_fail from grade_scale.
        const { data: scale } = await ctx.supabase
          .from("grade_scale").select("grade_point, is_fail")
          .eq("letter", parsed.data.letter_grade.toUpperCase()).maybeSingle();
        if (!scale) return jsonError(400, "Unknown letter grade");

        // Reject edit if already published.
        const { data: existing } = await ctx.supabase
          .from("grades").select("published_at")
          .eq("enrollment_id", parsed.data.enrollment_id).maybeSingle();
        if (existing?.published_at) return jsonError(409, "Grade already published; cannot edit");

        const { error } = await ctx.supabase.from("grades").upsert({
          enrollment_id: parsed.data.enrollment_id,
          letter_grade: parsed.data.letter_grade.toUpperCase(),
          is_fail: scale.is_fail,
          is_incomplete: parsed.data.is_incomplete ?? (parsed.data.letter_grade.toUpperCase() === "I"),
          published_at: null,
          published_by_user_id: null,
        }, { onConflict: "enrollment_id" });
        if (error) return jsonError(500, error.message);
        await writeAudit(ctx.supabase, ctx.userId, "grade.draft", "enrollment", parsed.data.enrollment_id, parsed.data);
        return Response.json({ ok: true });
      },
    },
  },
});
