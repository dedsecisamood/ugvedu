/**
 * Aggregated data for the student Overview / dashboard landing.
 * Server-side only; scopes to the authenticated caller.
 *
 * Returns null when the caller is not a student (e.g. staff-only user)
 * so the UI can render a graceful empty state.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OverviewNotice = {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string | null;
  is_read: boolean;
};

export type OverviewClass = {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string | null;
  course_code: string;
  course_title: string;
  section: string | null;
};

export type OverviewPayment = {
  id: string;
  amount_due: number;
  amount_paid: number;
  due_date: string | null;
  status: string;
};

export type OverviewData = {
  student: {
    userId: string;
    studentId: string;
    fullName: string;
    departmentCode: string | null;
    programName: string | null;
    currentSemesterName: string | null;
    admissionSemesterName: string | null;
    section: string | null;
    studentGroup: string | null;
    photoSignedUrl: string | null;
    registrationDeadline: string | null;
  } | null;
  cgpa: number | null;
  latestSemester: {
    name: string | null;
    status: "GENERATED" | "BLOCKED" | null;
    sgpa: number | null;
    blockedReason: string | null;
    departmentHeadName: string | null;
    departmentHeadEmail: string | null;
  };
  credits: { completed: number; required: number | null };
  notices: OverviewNotice[];
  todayClasses: OverviewClass[];
  todayCode: string;
  payments: {
    outstanding: number;
    overdue: boolean;
    items: OverviewPayment[];
  };
};

const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OverviewData> => {
    const { supabase, userId } = context;
    const todayCode = DAY_CODES[new Date().getUTCDay()];

    // 1. Student profile
    const { data: student } = await supabase
      .from("students")
      .select(
        "user_id, student_id, full_name, department_id, program_id, current_semester_id, departments(code, name), programs(name, total_credits_required), semesters!students_current_semester_id_fkey(name)",
      )
      .eq("user_id", userId)
      .maybeSingle();

    const empty: OverviewData = {
      student: null,
      cgpa: null,
      latestSemester: { name: null, status: null, sgpa: null, blockedReason: null, departmentHeadName: null, departmentHeadEmail: null },
      credits: { completed: 0, required: null },
      notices: [],
      todayClasses: [],
      todayCode,
      payments: { outstanding: 0, overdue: false, items: [] },
    };

    if (!student) return empty;

    const studentBlock = {
      userId: student.user_id,
      studentId: student.student_id,
      fullName: student.full_name,
      departmentCode:
        (student as unknown as { departments: { code: string } | null }).departments?.code ?? null,
      programName:
        (student as unknown as { programs: { name: string } | null }).programs?.name ?? null,
      currentSemesterName:
        (student as unknown as { semesters: { name: string } | null }).semesters?.name ?? null,
    };
    const requiredCredits =
      (student as unknown as { programs: { total_credits_required: number } | null }).programs
        ?.total_credits_required ?? null;

    // 2. Semester results → CGPA + latest semester status
    const { data: results } = await supabase
      .from("semester_results")
      .select("sgpa, status, blocked_reason, calculated_at, semester_id, semesters(name, year, term)")
      .eq("student_user_id", userId);

    const sorted = [...(results ?? [])].sort((a, b) => {
      const sa = (a as unknown as { semesters: { year: number; term: string } | null }).semesters;
      const sb = (b as unknown as { semesters: { year: number; term: string } | null }).semesters;
      if (!sa || !sb) return 0;
      if (sa.year !== sb.year) return sb.year - sa.year;
      return String(sb.term).localeCompare(String(sa.term));
    });
    const generated = sorted.filter((r) => r.status === "GENERATED" && r.sgpa != null);
    const cgpa =
      generated.length > 0
        ? Math.round(
            (generated.reduce((s, r) => s + Number(r.sgpa), 0) / generated.length) * 100,
          ) / 100
        : null;

    const latest = sorted[0];
    const latestSemester = latest
      ? {
          name:
            (latest as unknown as { semesters: { name: string } | null }).semesters?.name ?? null,
          status: (latest.status as "GENERATED" | "BLOCKED") ?? null,
          sgpa: latest.sgpa != null ? Number(latest.sgpa) : null,
          blockedReason: latest.blocked_reason ?? null,
          departmentHeadName: null as string | null,
          departmentHeadEmail: null as string | null,
        }
      : { name: null, status: null, sgpa: null, blockedReason: null, departmentHeadName: null, departmentHeadEmail: null };

    // Department head contact (if latest is blocked)
    if (latestSemester.status === "BLOCKED" && studentBlock.departmentCode) {
      const { data: head } = await supabase
        .from("profiles")
        .select("id, full_name, department, user_roles!inner(role)")
        .eq("department", studentBlock.departmentCode)
        .eq("user_roles.role", "department_head")
        .maybeSingle();
      if (head) {
        latestSemester.departmentHeadName = head.full_name;
        // We intentionally do not query auth.users for email; expose only the name.
        latestSemester.departmentHeadEmail = null;
      }
    }

    // 3. Credits completed (sum of course credits from published, non-fail, non-incomplete grades)
    const { data: enrolls } = await supabase
      .from("enrollments")
      .select(
        "id, status, course_offerings(course_id, courses(credits)), grades(letter_grade, is_fail, is_incomplete, published_at)",
      )
      .eq("student_user_id", userId);

    let completed = 0;
    for (const e of enrolls ?? []) {
      const grade = (e as unknown as { grades: { is_fail: boolean; is_incomplete: boolean; published_at: string | null }[] | null }).grades;
      const g = Array.isArray(grade) ? grade[0] : grade;
      if (!g || !g.published_at || g.is_fail || g.is_incomplete) continue;
      const credits =
        (e as unknown as { course_offerings: { courses: { credits: number } | null } | null })
          .course_offerings?.courses?.credits ?? 0;
      completed += Number(credits);
    }

    // 4. Notices (dept + semester scoped, top 5)
    let nq = supabase
      .from("notices")
      .select("id, title, body, is_pinned, published_at")
      .is("deleted_at", null)
      .not("published_at", "is", null)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(5);
    if (student.department_id) {
      nq = nq.or(`target_department_id.is.null,target_department_id.eq.${student.department_id}`);
    } else {
      nq = nq.is("target_department_id", null);
    }
    if (student.current_semester_id) {
      nq = nq.or(
        `target_semester_id.is.null,target_semester_id.eq.${student.current_semester_id}`,
      );
    } else {
      nq = nq.is("target_semester_id", null);
    }
    const { data: notices } = await nq;
    const noticeIds = (notices ?? []).map((n) => n.id);
    const { data: reads } = noticeIds.length
      ? await supabase.from("notice_reads").select("notice_id").in("notice_id", noticeIds).eq("user_id", userId)
      : { data: [] as { notice_id: string }[] };
    const readSet = new Set((reads ?? []).map((r) => r.notice_id));
    const noticesOut: OverviewNotice[] = (notices ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      is_pinned: n.is_pinned,
      published_at: n.published_at,
      is_read: readSet.has(n.id),
    }));

    // 5. Today's classes (from current-semester enrollments)
    let todayClasses: OverviewClass[] = [];
    if (student.current_semester_id) {
      const { data: myEnrolls } = await supabase
        .from("enrollments")
        .select("course_offering_id")
        .eq("student_user_id", userId)
        .eq("status", "ENROLLED");
      const offeringIds = (myEnrolls ?? []).map((e) => e.course_offering_id);
      if (offeringIds.length > 0) {
        const { data: scheds } = await supabase
          .from("class_schedules")
          .select(
            "id, day_of_week, start_time, end_time, room, course_offerings(section, semester_id, courses(code, title))",
          )
          .in("course_offering_id", offeringIds)
          .eq("day_of_week", todayCode);
        todayClasses = (scheds ?? [])
          .filter(
            (s) =>
              (s as unknown as { course_offerings: { semester_id: string } | null })
                .course_offerings?.semester_id === student.current_semester_id,
          )
          .map((s) => {
            const co = (s as unknown as {
              course_offerings: { section: string | null; courses: { code: string; title: string } | null } | null;
            }).course_offerings;
            return {
              id: s.id,
              day_of_week: s.day_of_week,
              start_time: s.start_time,
              end_time: s.end_time,
              room: s.room,
              course_code: co?.courses?.code ?? "—",
              course_title: co?.courses?.title ?? "",
              section: co?.section ?? null,
            };
          })
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
      }
    }

    // 6. Payments — outstanding balance
    const { data: pays } = await supabase
      .from("payments")
      .select("id, amount_due, amount_paid, due_date, status")
      .eq("student_user_id", userId)
      .in("status", ["PARTIAL", "OVERDUE"])
      .order("due_date", { ascending: true });
    const today = new Date().toISOString().slice(0, 10);
    let outstanding = 0;
    let overdue = false;
    for (const p of pays ?? []) {
      const remaining = Number(p.amount_due) - Number(p.amount_paid);
      if (remaining > 0) outstanding += remaining;
      if (p.due_date && p.due_date < today && remaining > 0) overdue = true;
      if (p.status === "OVERDUE") overdue = true;
    }

    return {
      student: studentBlock,
      cgpa,
      latestSemester,
      credits: { completed, required: requiredCredits != null ? Number(requiredCredits) : null },
      notices: noticesOut,
      todayClasses,
      todayCode,
      payments: {
        outstanding: Math.round(outstanding * 100) / 100,
        overdue,
        items: (pays ?? []).map((p) => ({
          id: p.id,
          amount_due: Number(p.amount_due),
          amount_paid: Number(p.amount_paid),
          due_date: p.due_date,
          status: p.status,
        })),
      },
    };
  });
