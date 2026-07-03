/**
 * /routine — a student's class schedule for a given semester (default: current).
 * Returned sorted by (day_of_week, start_time). Server-enforced self-scoping.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAY_ORDER: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

const routineInput = z.object({
  studentUserId: z.string().uuid(),
  semesterId: z.string().uuid().optional(),
});

export const getStudentRoutine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => routineInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.studentUserId !== userId) {
      const [{ data: isAdmin }, { data: isReg }, { data: isHead }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "registrar" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "department_head" }),
      ]);
      if (!isAdmin && !isReg && !isHead) throw new Error("Forbidden");
    }

    let semesterId = data.semesterId;
    if (!semesterId) {
      const { data: cur } = await supabase
        .from("semesters")
        .select("id")
        .eq("is_current", true)
        .maybeSingle();
      if (!cur) return { data: [], semesterId: null };
      semesterId = cur.id;
    }

    const { data: offerings, error: offErr } = await supabase
      .from("course_offerings")
      .select("id")
      .eq("semester_id", semesterId)
      .in(
        "id",
        (
          await supabase
            .from("enrollments")
            .select("course_offering_id")
            .eq("student_user_id", data.studentUserId)
            .eq("status", "ENROLLED")
        ).data?.map((r) => r.course_offering_id) ?? [],
      );
    if (offErr) throw new Error(offErr.message);
    const offeringIds = offerings?.map((o) => o.id) ?? [];
    if (offeringIds.length === 0) return { data: [], semesterId };

    const { data: schedules, error } = await supabase
      .from("class_schedules")
      .select(
        "id, day_of_week, start_time, end_time, room, course_offerings(id, section, courses(code, title), instructor_user_id)",
      )
      .in("course_offering_id", offeringIds);
    if (error) throw new Error(error.message);

    const sorted = [...(schedules ?? [])].sort((a, b) => {
      const d = (DAY_ORDER[a.day_of_week] ?? 99) - (DAY_ORDER[b.day_of_week] ?? 99);
      return d !== 0 ? d : a.start_time.localeCompare(b.start_time);
    });

    return { data: sorted, semesterId };
  });
