/**
 * POST /api/grades/publish/:offeringId
 *
 * Atomically publishes every draft grade for the offering (SQL fn locks the
 * offering row → all-or-nothing), then invokes the pure GPA engine to
 * recalculate SemesterResult for each affected student. Recalculation is
 * idempotent, so a partial retry after a crash is safe.
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticate, jsonError } from "@/lib/api-http";
import { writeAudit, requireRole } from "@/lib/audit";
import { calculateSemesterResult, type EnrollmentInput } from "@/lib/gpa-engine";

export const Route = createFileRoute("/api/grades/publish/$offeringId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;

        const isAdmin = await requireRole(ctx.supabase, ctx.userId, ["admin"]);
        const { data: offering } = await ctx.supabase
          .from("course_offerings").select("instructor_user_id").eq("id", params.offeringId).maybeSingle();
        if (!offering) return jsonError(404, "Offering not found");
        if (!isAdmin && offering.instructor_user_id !== ctx.userId) return jsonError(403, "Forbidden");

        const { data: affected, error } = await ctx.supabase.rpc("publish_offering_grades", {
          _course_offering_id: params.offeringId,
          _published_by: ctx.userId,
        });
        if (error) return jsonError(500, error.message);

        // Recalculate SGPA per (student, semester) affected.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        for (const row of (affected ?? []) as Array<{ student_user_id: string; semester_id: string }>) {
          const { data: rows } = await supabaseAdmin
            .from("enrollments")
            .select(`id, status,
              course_offerings!inner ( semester_id, courses!inner ( credits ) ),
              grades ( letter_grade, is_incomplete, is_fail )`)
            .eq("student_user_id", row.student_user_id)
            .eq("course_offerings.semester_id", row.semester_id);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const enrollments: EnrollmentInput[] = ((rows ?? []) as any[]).map((r) => {
            const g = r.grades?.[0];
            // Fetch grade_point via scale later? Simpler: join grade_scale in caller.
            return {
              enrollmentId: r.id,
              credits: r.course_offerings?.courses.credits ?? 0,
              gradePoint: g?.grade_point ?? 0,
              letterGrade: g?.letter_grade ?? null,
              isIncomplete: g?.is_incomplete ?? false,
              status: (r.status as EnrollmentInput["status"]) ?? "COMPLETED",
            };
          });

          // Enrich with grade points from grade_scale.
          const letters = Array.from(new Set(enrollments.map((e) => e.letterGrade).filter(Boolean))) as string[];
          if (letters.length) {
            const { data: scale } = await supabaseAdmin
              .from("grade_scale").select("letter, grade_point").in("letter", letters);
            const map = new Map((scale ?? []).map((s) => [s.letter, Number(s.grade_point)]));
            for (const e of enrollments) if (e.letterGrade) e.gradePoint = map.get(e.letterGrade) ?? 0;
          }

          const result = calculateSemesterResult({ semesterId: row.semester_id, enrollments });
          if (result.status === "EMPTY") continue;
          await supabaseAdmin.from("semester_results").upsert({
            student_user_id: row.student_user_id, semester_id: row.semester_id,
            status: result.status,
            sgpa: result.sgpa === null ? null : Number(result.sgpa),
            blocked_reason: result.blockedReason,
            calculated_at: new Date().toISOString(),
          }, { onConflict: "student_user_id,semester_id" });
        }

        await writeAudit(ctx.supabase, ctx.userId, "grades.publish", "course_offering", params.offeringId,
          { affected: (affected ?? []).length });
        return Response.json({ ok: true, affected: affected ?? [] });
      },
    },
  },
});
