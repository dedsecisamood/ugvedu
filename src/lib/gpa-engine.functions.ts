/**
 * DB wrapper around the pure GPA engine.
 *
 * The pure functions in ./gpa-engine.ts never touch the database. This module
 * is the ONLY place that reads enrollments/grades and writes semester_results.
 * Callers (server functions, admin actions) invoke recalculateSemesterResult()
 * after grades are published or edited — never on every page load.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  calculateSemesterResult,
  type EnrollmentInput,
} from "./gpa-engine";

const paramsSchema = z.object({
  studentUserId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

interface EnrollmentRow {
  id: string;
  status: string | null;
  course_offerings: {
    semester_id: string;
    courses: { credits: number | string };
  } | null;
  grades: Array<{
    letter_grade: string | null;
    grade_point: number | string | null;
    is_incomplete: boolean | null;
    is_fail: boolean | null;
  }> | null;
}

/**
 * Recalculate one (student, semester) result. Only admin / registrar /
 * department_head may trigger this — typically after resolving an F/I.
 * Idempotent: re-running with unchanged grades produces the identical row.
 */
export const recalculateSemesterResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => paramsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = new Set((roleRows ?? []).map((r) => r.role));
    if (!roles.has("admin") && !roles.has("registrar") && !roles.has("department_head")) {
      throw new Error("Forbidden");
    }

    const { data: rows, error } = await supabase
      .from("enrollments")
      .select(
        `id, status,
         course_offerings!inner ( semester_id, courses!inner ( credits ) ),
         grades ( letter_grade, grade_point, is_incomplete, is_fail )`,
      )
      .eq("student_user_id", data.studentUserId)
      .eq("course_offerings.semester_id", data.semesterId);

    if (error) throw new Error(error.message);

    const enrollments: EnrollmentInput[] = ((rows ?? []) as unknown as EnrollmentRow[]).map((r) => {
      const g = r.grades?.[0];
      return {
        enrollmentId: r.id,
        credits: r.course_offerings?.courses.credits ?? 0,
        gradePoint: g?.grade_point ?? null,
        letterGrade: g?.letter_grade ?? null,
        isIncomplete: g?.is_incomplete ?? false,
        status: (r.status as EnrollmentInput["status"]) ?? "COMPLETED",
      };
    });

    const result = calculateSemesterResult({
      semesterId: data.semesterId,
      enrollments,
    });

    // EMPTY = no counted enrollments; don't persist, just report.
    if (result.status === "EMPTY") return { ok: true as const, result, persisted: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin
      .from("semester_results")
      .upsert(
        {
          student_user_id: data.studentUserId,
          semester_id: data.semesterId,
          status: result.status,          // "GENERATED" | "BLOCKED"
          sgpa: result.sgpa,               // string | null — Postgres NUMERIC accepts strings
          blocked_reason: result.blockedReason,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: "student_user_id,semester_id" },
      );
    if (upErr) throw new Error(upErr.message);

    return { ok: true as const, result, persisted: true };
  });
