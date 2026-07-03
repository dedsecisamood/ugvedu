/**
 * Department-head workflow: view blocked students, resolve Incompletes.
 *
 * All reads go through the caller's Supabase client so RLS enforces
 * "only students in the head's own department are visible." A dept head
 * from a different department gets an empty list, and any attempt to
 * resolve is rejected by resolve_incomplete_grade() at the SQL layer.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateSemesterResult, type EnrollmentInput } from "./gpa-engine";

export type BlockedStudentRow = {
  studentUserId: string;
  studentId: string;
  fullName: string;
  semesterId: string;
  semesterName: string;
  calculatedAt: string;
  blockedReason: string | null;
};

export const listBlockedStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BlockedStudentRow[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("semester_results")
      .select(
        "student_user_id, semester_id, calculated_at, blocked_reason, status, students!inner(student_id, full_name), semesters!inner(name)",
      )
      .eq("status", "BLOCKED")
      .order("calculated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      studentUserId: r.student_user_id,
      studentId: (r.students as { student_id: string }).student_id,
      fullName: (r.students as { full_name: string }).full_name,
      semesterId: r.semester_id,
      semesterName: (r.semesters as { name: string }).name,
      calculatedAt: r.calculated_at,
      blockedReason: r.blocked_reason ?? null,
    }));
  });

export type BlockedDetailGradeRow = {
  enrollmentId: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
  letterGrade: string | null;
  isIncomplete: boolean;
  isFail: boolean;
  publishedAt: string | null;
};

export type BlockedDetail = {
  student: { userId: string; studentId: string; fullName: string; departmentCode: string | null };
  semester: { id: string; name: string };
  reason: string | null;
  grades: BlockedDetailGradeRow[];
};

const detailSchema = z.object({
  studentUserId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

export const getBlockedStudentDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => detailSchema.parse(input))
  .handler(async ({ context, data }): Promise<BlockedDetail> => {
    const { supabase } = context;
    // RLS ensures this student is in the caller's department (or caller is admin).
    const { data: student, error: se } = await supabase
      .from("students")
      .select("user_id, student_id, full_name, departments(code)")
      .eq("user_id", data.studentUserId)
      .maybeSingle();
    if (se) throw new Error(se.message);
    if (!student) throw new Error("Forbidden");

    const { data: sr } = await supabase
      .from("semester_results")
      .select("blocked_reason, semesters!inner(name)")
      .eq("student_user_id", data.studentUserId)
      .eq("semester_id", data.semesterId)
      .maybeSingle();

    const { data: rows, error } = await supabase
      .from("enrollments")
      .select(
        "id, course_offerings!inner(semester_id, courses!inner(code, title, credits)), grades(letter_grade, is_incomplete, is_fail, published_at)",
      )
      .eq("student_user_id", data.studentUserId)
      .eq("course_offerings.semester_id", data.semesterId);
    if (error) throw new Error(error.message);

    const grades: BlockedDetailGradeRow[] = ((rows ?? []) as unknown as Array<{
      id: string;
      course_offerings: { courses: { code: string; title: string; credits: number } };
      grades: Array<{ letter_grade: string | null; is_incomplete: boolean | null; is_fail: boolean | null; published_at: string | null }>;
    }>).map((r) => {
      const g = r.grades?.[0];
      return {
        enrollmentId: r.id,
        courseCode: r.course_offerings.courses.code,
        courseTitle: r.course_offerings.courses.title,
        credits: Number(r.course_offerings.courses.credits),
        letterGrade: g?.letter_grade ?? null,
        isIncomplete: !!g?.is_incomplete,
        isFail: !!g?.is_fail,
        publishedAt: g?.published_at ?? null,
      };
    });

    return {
      student: {
        userId: student.user_id,
        studentId: student.student_id,
        fullName: student.full_name,
        departmentCode: (student.departments as { code: string } | null)?.code ?? null,
      },
      semester: {
        id: data.semesterId,
        name: (sr?.semesters as { name: string } | null)?.name ?? "",
      },
      reason: sr?.blocked_reason ?? null,
      grades,
    };
  });

const resolveSchema = z.object({
  enrollmentId: z.string().uuid(),
  newLetter: z.string().trim().min(1).max(3),
  note: z.string().trim().max(500).optional(),
});

/**
 * Resolve an Incomplete → real letter. The RPC is SECURITY DEFINER and
 * re-verifies (admin OR is_head_of_student) inside SQL, so a dept head from
 * the wrong department gets `error: 'Forbidden'` even if the UI is bypassed.
 * After the update we recalculate the semester result inline — the pure
 * engine flips BLOCKED → GENERATED when there are no F/I rows left.
 */
export const resolveIncomplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resolveSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("resolve_incomplete_grade", {
      _enrollment_id: data.enrollmentId,
      _new_letter: data.newLetter.toUpperCase(),
      _resolver: userId,
      _note: data.note ?? undefined,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    const res = rpcRes as { ok: boolean; error?: string; student_user_id?: string; semester_id?: string };
    if (!res.ok) throw new Error(res.error ?? "Failed to resolve");

    // Recalculate — use service role to bypass RLS for the write.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: enrRows } = await supabaseAdmin
      .from("enrollments")
      .select("id, status, course_offerings!inner(semester_id, courses!inner(credits)), grades(letter_grade, is_incomplete, is_fail)")
      .eq("student_user_id", res.student_user_id!)
      .eq("course_offerings.semester_id", res.semester_id!);

    const enrollments: EnrollmentInput[] = ((enrRows ?? []) as unknown as Array<{
      id: string; status: string | null;
      course_offerings: { courses: { credits: number } };
      grades: Array<{ letter_grade: string | null; is_incomplete: boolean | null; is_fail: boolean | null }>;
    }>).map((r) => {
      const g = r.grades?.[0];
      return {
        enrollmentId: r.id,
        credits: Number(r.course_offerings.courses.credits),
        gradePoint: 0,
        letterGrade: g?.letter_grade ?? null,
        isIncomplete: !!g?.is_incomplete,
        status: (r.status as EnrollmentInput["status"]) ?? "COMPLETED",
      };
    });
    const letters = Array.from(new Set(enrollments.map((e) => e.letterGrade).filter(Boolean))) as string[];
    if (letters.length) {
      const { data: scale } = await supabaseAdmin
        .from("grade_scale").select("letter, grade_point").in("letter", letters);
      const gpMap = new Map((scale ?? []).map((s) => [s.letter, Number(s.grade_point)]));
      for (const e of enrollments) if (e.letterGrade) e.gradePoint = gpMap.get(e.letterGrade) ?? 0;
    }
    const result = calculateSemesterResult({ semesterId: res.semester_id!, enrollments });
    if (result.status !== "EMPTY") {
      await supabaseAdmin.from("semester_results").upsert({
        student_user_id: res.student_user_id!, semester_id: res.semester_id!,
        status: result.status,
        sgpa: result.sgpa === null ? null : Number(result.sgpa),
        blocked_reason: result.blockedReason,
        calculated_at: new Date().toISOString(),
      }, { onConflict: "student_user_id,semester_id" });
    }
    return { ok: true, newStatus: result.status };
  });
