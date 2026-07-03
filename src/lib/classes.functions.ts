/**
 * getMyClasses — currently ENROLLED course offerings for the authenticated
 * student in the active (or specified) semester. Self-scoped by RLS.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ semesterId: z.string().uuid().optional() }).optional();

export type ClassRow = {
  enrollmentId: string;
  offeringId: string;
  courseId: string;
  code: string;
  title: string;
  credits: number;
  section: string | null;
  instructorName: string | null;
  schedulesCount: number;
  semesterName: string;
};

export const getMyClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => (input.parse(raw ?? {}) ?? {}))
  .handler(async ({ context, data }): Promise<{ semesterId: string | null; semesterName: string | null; classes: ClassRow[] }> => {
    const { supabase, userId } = context;

    let semesterId = data?.semesterId ?? null;
    let semesterName: string | null = null;
    if (!semesterId) {
      const { data: cur } = await supabase
        .from("semesters")
        .select("id, name")
        .eq("is_current", true)
        .maybeSingle();
      if (!cur) return { semesterId: null, semesterName: null, classes: [] };
      semesterId = cur.id;
      semesterName = cur.name;
    } else {
      const { data: s } = await supabase.from("semesters").select("name").eq("id", semesterId).maybeSingle();
      semesterName = s?.name ?? null;
    }

    const { data: enrolls, error } = await supabase
      .from("enrollments")
      .select(
        `id, status, course_offering_id,
         course_offerings!inner (
           id, section, instructor_user_id, semester_id,
           courses!inner ( id, code, title, credits ),
           class_schedules ( id )
         )`,
      )
      .eq("student_user_id", userId)
      .eq("status", "ENROLLED")
      .eq("course_offerings.semester_id", semesterId);
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      course_offering_id: string;
      course_offerings: {
        id: string;
        section: string | null;
        instructor_user_id: string | null;
        courses: { id: string; code: string; title: string; credits: number };
        class_schedules: { id: string }[] | null;
      };
    };
    const typed = (enrolls ?? []) as unknown as Row[];

    // Pull instructor names in one shot
    const instructorIds = Array.from(
      new Set(
        typed
          .map((r) => r.course_offerings.instructor_user_id)
          .filter((x): x is string => typeof x === "string" && x.length > 0),
      ),
    );
    const nameOf = new Map<string, string>();
    if (instructorIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", instructorIds);
      for (const p of profs ?? []) nameOf.set(p.id, p.full_name ?? "");
    }

    const classes: ClassRow[] = typed
      .map((r) => ({
        enrollmentId: r.id,
        offeringId: r.course_offerings.id,
        courseId: r.course_offerings.courses.id,
        code: r.course_offerings.courses.code,
        title: r.course_offerings.courses.title,
        credits: Number(r.course_offerings.courses.credits),
        section: r.course_offerings.section,
        instructorName: r.course_offerings.instructor_user_id
          ? nameOf.get(r.course_offerings.instructor_user_id) ?? null
          : null,
        schedulesCount: r.course_offerings.class_schedules?.length ?? 0,
        semesterName: semesterName ?? "",
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    return { semesterId, semesterName, classes };
  });
