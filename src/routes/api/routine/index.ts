/**
 * GET /api/routine?studentUserId=<uuid>&semesterId=<uuid?>
 * Returns the caller's class schedule, sorted by (day, time).
 * Self-scoped: STUDENT can only ever query own userId.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, jsonError } from "@/lib/api-http";

const DAY_ORDER: Record<string, number> = { SUN:0, MON:1, TUE:2, WED:3, THU:4, FRI:5, SAT:6 };

const query = z.object({
  studentUserId: z.string().uuid(),
  semesterId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/routine/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;

        const url = new URL(request.url);
        const parsed = query.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) return jsonError(400, "Invalid query", { issues: parsed.error.issues });
        const p = parsed.data;

        if (p.studentUserId !== ctx.userId) {
          const [{ data: a }, { data: r }, { data: h }] = await Promise.all([
            ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
            ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "registrar" }),
            ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "department_head" }),
          ]);
          if (!a && !r && !h) return jsonError(403, "Forbidden");
        }

        let semesterId = p.semesterId;
        if (!semesterId) {
          const { data: cur } = await ctx.supabase.from("semesters").select("id").eq("is_current", true).maybeSingle();
          if (!cur) return Response.json({ data: [], semesterId: null });
          semesterId = cur.id;
        }

        const { data: enrolls } = await ctx.supabase
          .from("enrollments").select("course_offering_id")
          .eq("student_user_id", p.studentUserId).eq("status", "ENROLLED");
        const enrolledOfferingIds = enrolls?.map((e) => e.course_offering_id) ?? [];
        if (enrolledOfferingIds.length === 0) return Response.json({ data: [], semesterId });

        const { data: offs } = await ctx.supabase
          .from("course_offerings").select("id")
          .eq("semester_id", semesterId).in("id", enrolledOfferingIds);
        const offeringIds = offs?.map((o) => o.id) ?? [];
        if (offeringIds.length === 0) return Response.json({ data: [], semesterId });

        const { data: schedules, error } = await ctx.supabase
          .from("class_schedules")
          .select("id, day_of_week, start_time, end_time, room, course_offerings(id, section, courses(code, title), instructor_user_id)")
          .in("course_offering_id", offeringIds);
        if (error) return jsonError(500, error.message);

        const sorted = [...(schedules ?? [])].sort((a, b) => {
          const d = (DAY_ORDER[a.day_of_week] ?? 99) - (DAY_ORDER[b.day_of_week] ?? 99);
          return d !== 0 ? d : a.start_time.localeCompare(b.start_time);
        });
        return Response.json({ data: sorted, semesterId });
      },
    },
  },
});
