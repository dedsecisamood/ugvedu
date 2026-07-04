/**
 * Full per-semester breakdown for the Results page.
 * Self-scoped: a caller always gets their own record. Privileged roles
 * (admin/registrar/department_head) may pass ?studentUserId to view others.
 *
 * CGPA policy (documented once, applied consistently):
 *   If ANY semester is BLOCKED, CGPA is null → UI renders "—".
 *   Rationale: a partial CGPA computed only from GENERATED semesters is
 *   misleading — the student has unresolved credits that will change the
 *   final number. Better to show nothing than a value that will move.
 *   Once every semester is GENERATED, CGPA is the credit-weighted average
 *   from the pure GPA engine.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  calculateSemesterResult,
  calculateCGPA,
  type EnrollmentInput,
  type SemesterInput,
} from "./gpa-engine";

const paramsSchema = z.object({
  studentUserId: z.string().uuid().optional(),
});

export type ResultsCourseRow = {
  enrollmentId: string;
  code: string;
  title: string;
  credits: number;
  letterGrade: string | null;
  gradePoint: number | null;
  isFail: boolean;
  isIncomplete: boolean;
};

export type ResultsSemester = {
  semesterId: string;
  semesterName: string;
  year: number;
  term: string;
  ordinal: number; // 1-based semester index in chronological order
  status: "GENERATED" | "BLOCKED" | "EMPTY";
  sgpa: string | null;
  totalCredits: string;
  blockedReason: string | null;
  blockingCourses: { code: string; title: string; reason: "F" | "I" }[];
  courses: ResultsCourseRow[];
};

export type ResultsPayload = {
  student: {
    userId: string;
    studentId: string;
    fullName: string;
    departmentName: string | null;
    departmentCode: string | null;
    currentSemesterName: string | null;
  } | null;
  cgpa: string | null;
  cgpaPolicy: "blocked-hides-cgpa";
  totalEntries: number;
  semesterCount: number;
  semesters: ResultsSemester[]; // newest first
};

export const getStudentResultsDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => paramsSchema.parse(raw ?? {}))
  .handler(async ({ context, data }): Promise<ResultsPayload> => {
    const { supabase, userId } = context;
    const targetId = data.studentUserId ?? userId;

    // Authorization: self OR privileged role.
    if (targetId !== userId) {
      const [{ data: isAdmin }, { data: isReg }, { data: isHead }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "registrar" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "department_head" }),
      ]);
      if (!isAdmin && !isReg && !isHead) throw new Error("Forbidden");
    }

    const { data: student } = await supabase
      .from("students")
      .select("user_id, student_id, full_name, departments(code, name), semesters!students_current_semester_id_fkey(name)")
      .eq("user_id", targetId)
      .maybeSingle();

    if (!student) {
      return {
        student: null,
        cgpa: null,
        cgpaPolicy: "blocked-hides-cgpa",
        totalEntries: 0,
        semesterCount: 0,
        semesters: [],
      };
    }

    const dept = (student as unknown as { departments: { code: string; name: string } | null }).departments;
    const curSem = (student as unknown as { semesters: { name: string } | null }).semesters;

    // Pull all enrollments with grades + course + semester
    const { data: rows, error } = await supabase
      .from("enrollments")
      .select(
        `id, status,
         course_offerings!inner (
           semester_id,
           semesters!inner ( id, name, year, term ),
           courses!inner ( code, title, credits )
         ),
         grades ( letter_grade, is_fail, is_incomplete )`,
      )
      .eq("student_user_id", targetId);
    if (error) throw new Error(error.message);

    // Load the full grade scale once so we can map letter → grade_point.
    const { data: scale } = await supabase.from("grade_scale").select("letter, grade_point");
    const gradePointOf = new Map<string, number>(
      (scale ?? []).map((r) => [r.letter, Number(r.grade_point)]),
    );

    type Row = {
      id: string;
      status: string | null;
      course_offerings: {
        semester_id: string;
        semesters: { id: string; name: string; year: number; term: string };
        courses: { code: string; title: string; credits: number | string };
      };
      grades:
        | { letter_grade: string | null; is_fail: boolean | null; is_incomplete: boolean | null }
        | { letter_grade: string | null; is_fail: boolean | null; is_incomplete: boolean | null }[]
        | null;
    };
    const typed = (rows ?? []) as unknown as Row[];

    const gradeOf = (row: Row) =>
      Array.isArray(row.grades) ? row.grades[0] : row.grades;

    // Group by semester
    const bySem = new Map<string, {
      meta: { id: string; name: string; year: number; term: string };
      rows: (Row & { gp: number | null })[];
    }>();
    for (const r of typed) {
      const co = r.course_offerings;
      const g = gradeOf(r);
      const gp = g?.letter_grade ? gradePointOf.get(g.letter_grade) ?? null : null;
      const bucket = bySem.get(co.semester_id) ?? { meta: co.semesters, rows: [] };
      bucket.rows.push({ ...r, gp });
      bySem.set(co.semester_id, bucket);
    }

    // Chronological order for ordinals
    const TERM_ORDER: Record<string, number> = { SPRING: 0, SUMMER: 1, FALL: 2, WINTER: 3 };
    const chrono = [...bySem.values()].sort((a, b) => {
      if (a.meta.year !== b.meta.year) return a.meta.year - b.meta.year;
      return (TERM_ORDER[a.meta.term] ?? 9) - (TERM_ORDER[b.meta.term] ?? 9);
    });

    const semesters: ResultsSemester[] = chrono.map((bucket, idx) => {
      const enrollments: EnrollmentInput[] = bucket.rows.map((r) => ({
        enrollmentId: r.id,
        credits: r.course_offerings.courses.credits,
        gradePoint: r.gp,
        letterGrade: gradeOf(r)?.letter_grade ?? null,
        isIncomplete: !!gradeOf(r)?.is_incomplete,
        status: (r.status as EnrollmentInput["status"]) ?? "COMPLETED",
      }));
      const res = calculateSemesterResult({ semesterId: bucket.meta.id, enrollments });
      const blocking = bucket.rows
        .filter((r) => {
          const g = gradeOf(r);
          if (!g) return false;
          return g.is_incomplete || (g.letter_grade ?? "").toUpperCase() === "F";
        })
        .map((r) => ({
          code: r.course_offerings.courses.code,
          title: r.course_offerings.courses.title,
          reason: (gradeOf(r)?.is_incomplete ? "I" : "F") as "F" | "I",
        }));

      const courses: ResultsCourseRow[] = bucket.rows
        .map((r) => ({
          enrollmentId: r.id,
          code: r.course_offerings.courses.code,
          title: r.course_offerings.courses.title,
          credits: Number(r.course_offerings.courses.credits),
          letterGrade: gradeOf(r)?.letter_grade ?? null,
          gradePoint: r.gp,
          isFail: !!gradeOf(r)?.is_fail,
          isIncomplete: !!gradeOf(r)?.is_incomplete,
        }))
        .sort((a, b) => a.code.localeCompare(b.code));

      return {
        semesterId: bucket.meta.id,
        semesterName: bucket.meta.name,
        year: bucket.meta.year,
        term: bucket.meta.term,
        ordinal: idx + 1,
        status: res.status,
        sgpa: res.sgpa,
        totalCredits: res.totalCredits,
        blockedReason: res.blockedReason,
        blockingCourses: blocking,
        courses,
      };
    });

    const cgpaInputs: SemesterInput[] = chrono.map((bucket) => ({
      semesterId: bucket.meta.id,
      enrollments: bucket.rows.map((r) => ({
        enrollmentId: r.id,
        credits: r.course_offerings.courses.credits,
        gradePoint: r.gp,
        letterGrade: gradeOf(r)?.letter_grade ?? null,
        isIncomplete: !!gradeOf(r)?.is_incomplete,
        status: (r.status as EnrollmentInput["status"]) ?? "COMPLETED",
      })),
    }));
    const anyBlocked = semesters.some((s) => s.status === "BLOCKED");
    const cgpaResult = calculateCGPA(cgpaInputs);
    const cgpa = anyBlocked ? null : cgpaResult.cgpa;

    // Newest first for display
    const semestersNewestFirst = [...semesters].reverse();

    return {
      student: {
        userId: student.user_id,
        studentId: student.student_id,
        fullName: student.full_name,
        departmentName: dept?.name ?? null,
        departmentCode: dept?.code ?? null,
        currentSemesterName: curSem?.name ?? null,
      },
      cgpa,
      cgpaPolicy: "blocked-hides-cgpa",
      totalEntries: semesters.reduce((n, s) => n + s.courses.length, 0),
      semesterCount: semesters.length,
      semesters: semestersNewestFirst,
    };
  });
