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
  calculateCGPA,
  type EnrollmentInput,
} from "./gpa-engine";

const paramsSchema = z.object({
  studentUserId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

/**
 * Admin / department-head / registrar triggered recalculation for a single
 * (student, semester) pair. Idempotent: re-running with unchanged grades
 * produces the identical stored row.
 */
export const recalculateSemesterResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => paramsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Role check. Students may not recalc; only admin/registrar/department_head.
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = new Set((roleRows ?? []).map((r) => r.role));
    if (!roles.has("admin") && !roles.has("registrar") && !roles.has("department_head")) {
      throw new Error("Forbidden");
    }

    const enrollments = await loadEnrollments(supabase, data.studentUserId, data.semesterId);
    const result = calculateSemesterResult({
      semesterId: data.semesterId,
      enrollments,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("semester_results").upsert(
      {
        student_user_id: data.studentUserId,
        semester_id: data.semesterId,
        status: result.status,
        sgpa: result.sgpa,
        total_credits: result.totalCredits,
        blocked_reason: result.blockedReason,
        generated_by: userId,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "student_user_id,semester_id" },
    );
    if (error) throw new Error(error.message);

    return { ok: true as const, result };
  });

// ----- helpers -----
type SupabaseClient = Parameters<typeof requireSupabaseAuth>[0] extends never
  ? never
  : never;

async function loadEnrollments(
  supabase: {
    from: (t: string) => {
      select: (s: string) => {
        eq: (col: string, val: string) => {
          eq: (col2: string, val2: string) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
    };
  },
  studentUserId: string,
  semesterId: string,
): Promise<EnrollmentInput[]> {
  // Enrollment row + course credit + grade information joined server-side.
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (a: string, b: string) => {
          eq: (a: string, b: string) => Promise<{ data: EnrollmentRow[] | null; error: { message: string } | null }>;
        };
      };
    };
  })
    .from("enrollments")
    .select(
      `id, status,
       course_offerings!inner ( semester_id, courses!inner ( credits ) ),
       grades ( letter_grade, grade_point, is_incomplete, is_fail )`,
    )
    .eq("student_user_id", studentUserId)
    .eq("course_offerings.semester_id", semesterId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    enrollmentId: r.id,
    credits: r.course_offerings.courses.credits,
    gradePoint: r.grades?.grade_point ?? null,
    letterGrade: r.grades?.letter_grade ?? null,
    isIncomplete: r.grades?.is_incomplete ?? false,
    status: (r.status as EnrollmentInput["status"]) ?? "COMPLETED",
  }));
}

interface EnrollmentRow {
  id: string;
  status: string | null;
  course_offerings: { semester_id: string; courses: { credits: number | string } };
  grades: {
    letter_grade: string | null;
    grade_point: number | string | null;
    is_incomplete: boolean | null;
    is_fail: boolean | null;
  } | null;
}

export { calculateCGPA }; // re-export for convenience in server routes/pages
export type { SupabaseClient };
