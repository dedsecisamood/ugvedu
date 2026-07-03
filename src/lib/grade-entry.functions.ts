/**
 * Grade entry sheet server fns. The write path re-hits the existing REST
 * endpoints (/api/grades, /api/grades/publish/:id) — no logic duplication.
 * These server fns are just data readers for the UI.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OfferingChoice = {
  id: string;
  section: string | null;
  courseCode: string;
  courseTitle: string;
  semesterName: string;
  instructorName: string | null;
};

export const listGradeableOfferings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OfferingChoice[]> => {
    const { supabase, userId } = context;
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roleRows ?? []).some((r) => r.role === "admin" || r.role === "registrar");
    let q = supabase
      .from("course_offerings")
      .select(
        "id, section, instructor_user_id, courses!inner(code, title), semesters!inner(name, year, term)",
      )
      .order("id", { ascending: false });
    if (!isAdmin) q = q.eq("instructor_user_id", userId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<{
      id: string; section: string | null; instructor_user_id: string | null;
      courses: { code: string; title: string };
      semesters: { name: string };
    }>).map((r) => ({
      id: r.id,
      section: r.section,
      courseCode: r.courses.code,
      courseTitle: r.courses.title,
      semesterName: r.semesters.name,
      instructorName: null,
    }));
  });

export type RosterEntry = {
  enrollmentId: string;
  studentUserId: string;
  studentId: string;
  fullName: string;
  letterGrade: string | null;
  isIncomplete: boolean;
  publishedAt: string | null;
};
export type GradeScaleEntry = { letter: string; gradePoint: number | null; isFail: boolean };
export type RosterData = { entries: RosterEntry[]; scale: GradeScaleEntry[] };

export const getRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ offeringId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<RosterData> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("enrollments")
      .select("id, student_user_id, students!inner(student_id, full_name), grades(letter_grade, is_incomplete, published_at)")
      .eq("course_offering_id", data.offeringId)
      .neq("status", "DROPPED");
    if (error) throw new Error(error.message);
    const { data: scale } = await supabase
      .from("grade_scale")
      .select("letter, grade_point, is_fail")
      .order("sort_order");
    const entries: RosterEntry[] = ((rows ?? []) as unknown as Array<{
      id: string; student_user_id: string;
      students: { student_id: string; full_name: string };
      grades: Array<{ letter_grade: string | null; is_incomplete: boolean | null; published_at: string | null }>;
    }>).map((r) => {
      const g = r.grades?.[0];
      return {
        enrollmentId: r.id,
        studentUserId: r.student_user_id,
        studentId: r.students.student_id,
        fullName: r.students.full_name,
        letterGrade: g?.letter_grade ?? null,
        isIncomplete: !!g?.is_incomplete,
        publishedAt: g?.published_at ?? null,
      };
    });
    return {
      entries: entries.sort((a, b) => a.studentId.localeCompare(b.studentId)),
      scale: (scale ?? []).map((s) => ({
        letter: s.letter, gradePoint: s.grade_point === null ? null : Number(s.grade_point), isFail: s.is_fail,
      })),
    };
  });

/** Save draft — bypasses REST envelope by calling supabase directly (admin/instructor). */
export const saveDraftGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      enrollmentId: z.string().uuid(),
      letterGrade: z.string().min(1).max(3),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Authorization: admin OR instructor of the offering.
    const { data: enr } = await supabase
      .from("enrollments").select("course_offering_id")
      .eq("id", data.enrollmentId).maybeSingle();
    if (!enr) throw new Error("Enrollment not found");
    const { data: off } = await supabase
      .from("course_offerings").select("instructor_user_id").eq("id", enr.course_offering_id).maybeSingle();
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isStaff = (roleRows ?? []).some((r) => r.role === "admin" || r.role === "registrar");
    if (!isStaff && off?.instructor_user_id !== userId) throw new Error("Forbidden");

    const letter = data.letterGrade.toUpperCase();
    const { data: scale } = await supabase.from("grade_scale")
      .select("grade_point, is_fail").eq("letter", letter).maybeSingle();
    if (!scale) throw new Error("Unknown letter grade");

    const { data: existing } = await supabase.from("grades").select("published_at")
      .eq("enrollment_id", data.enrollmentId).maybeSingle();
    if (existing?.published_at) throw new Error("Grade already published; cannot edit as draft");

    const { error } = await supabase.from("grades").upsert({
      enrollment_id: data.enrollmentId,
      letter_grade: letter,
      is_fail: scale.is_fail,
      is_incomplete: letter === "I",
      published_at: null,
      published_by_user_id: null,
    }, { onConflict: "enrollment_id" });
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert({
      user_id: userId, action: "grade.draft", entity_type: "enrollment",
      entity_id: data.enrollmentId, changes: { letter },
    });
    return { ok: true };
  });

/** Publish — atomically publishes every draft for the offering + recalculates. */
export const publishOfferingGrades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ offeringId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");
    const { data: off } = await supabase
      .from("course_offerings").select("instructor_user_id").eq("id", data.offeringId).maybeSingle();
    if (!off) throw new Error("Offering not found");
    if (!isAdmin && off.instructor_user_id !== userId) throw new Error("Forbidden");

    const { data: affected, error } = await supabase.rpc("publish_offering_grades", {
      _course_offering_id: data.offeringId, _published_by: userId,
    });
    if (error) throw new Error(error.message);

    // Recalculate per (student, semester)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { calculateSemesterResult } = await import("./gpa-engine");
    for (const row of (affected ?? []) as Array<{ student_user_id: string; semester_id: string }>) {
      const { data: rows } = await supabaseAdmin
        .from("enrollments")
        .select("id, status, course_offerings!inner(semester_id, courses!inner(credits)), grades(letter_grade, is_incomplete, is_fail)")
        .eq("student_user_id", row.student_user_id)
        .eq("course_offerings.semester_id", row.semester_id);
      const enrollments = ((rows ?? []) as unknown as Array<{
        id: string; status: string | null;
        course_offerings: { courses: { credits: number } };
        grades: Array<{ letter_grade: string | null; is_incomplete: boolean | null; is_fail: boolean | null }>;
      }>).map((r) => {
        const g = r.grades?.[0];
        return {
          enrollmentId: r.id, credits: Number(r.course_offerings.courses.credits),
          gradePoint: 0, letterGrade: g?.letter_grade ?? null,
          isIncomplete: !!g?.is_incomplete,
          status: (r.status as "COMPLETED" | "ENROLLED" | "DROPPED" | "RETAKE") ?? "COMPLETED",
        };
      });
      const letters = Array.from(new Set(enrollments.map((e) => e.letterGrade).filter(Boolean))) as string[];
      if (letters.length) {
        const { data: scale } = await supabaseAdmin.from("grade_scale").select("letter, grade_point").in("letter", letters);
        const gpMap = new Map((scale ?? []).map((s) => [s.letter, Number(s.grade_point)]));
        for (const e of enrollments) if (e.letterGrade) e.gradePoint = gpMap.get(e.letterGrade) ?? 0;
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
    await supabase.from("audit_log").insert({
      user_id: userId, action: "grades.publish", entity_type: "course_offering",
      entity_id: data.offeringId, changes: { count: (affected ?? []).length },
    });
    return { ok: true, count: (affected ?? []).length };
  });
