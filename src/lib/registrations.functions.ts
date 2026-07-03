/**
 * Registrations — page-facing server fns.
 *
 * Semester selection: "upcoming semester for registration" = the semester
 * whose registration window is open now, else the next one opening in the
 * future, else the current semester (as a fallback so the page always has
 * context to render).
 *
 * Capacity accounting mirrors register_for_offering(): APPROVED registrations
 * + ENROLLED/COMPLETED enrollments. PENDING does NOT hold a seat.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RegistrationSemester = {
  id: string;
  name: string;
  term: string;
  year: number;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  /** derived, server-authoritative "window is open right now". */
  window_open: boolean;
};

export type OfferingRow = {
  offeringId: string;
  courseId: string;
  code: string;
  title: string;
  credits: number;
  section: string | null;
  capacity: number;
  taken: number;
  instructorName: string | null;
  alreadyRegistered: boolean;
  registrationStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  alreadyEnrolled: boolean;
};

export type MyRegistration = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requested_at: string;
  decided_at: string | null;
  offering: {
    offeringId: string;
    code: string;
    title: string;
    credits: number;
    section: string | null;
    semesterName: string;
  } | null;
};

async function pickRegistrationSemester(
  supabase: {
    from: (t: string) => {
      select: (s: string) => {
        eq: (k: string, v: unknown) => {
          maybeSingle: () => Promise<{ data: unknown }>;
        };
        not: (k: string, o: string, v: unknown) => {
          gte: (k: string, v: unknown) => {
            order: (k: string, o?: { ascending?: boolean }) => {
              limit: (n: number) => { maybeSingle: () => Promise<{ data: unknown }> };
            };
          };
        };
      };
    };
  },
): Promise<RegistrationSemester | null> {
  const nowIso = new Date().toISOString();

  // 1. Any semester whose window is open right now.
  const { data: openRow } = await (supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        lte: (k: string, v: unknown) => {
          gte: (k: string, v: unknown) => {
            order: (k: string, o?: { ascending?: boolean }) => {
              limit: (n: number) => { maybeSingle: () => Promise<{ data: unknown }> };
            };
          };
        };
      };
    };
  })
    .from("semesters")
    .select("id, name, term, year, registration_opens_at, registration_closes_at")
    .lte("registration_opens_at", nowIso)
    .gte("registration_closes_at", nowIso)
    .order("registration_opens_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = openRow as {
    id: string;
    name: string;
    term: string;
    year: number;
    registration_opens_at: string | null;
    registration_closes_at: string | null;
  } | null;

  if (row) return { ...row, window_open: true };

  // 2. Next semester opening in the future.
  const { data: nextRow } = await (supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        gt: (k: string, v: unknown) => {
          order: (k: string, o?: { ascending?: boolean }) => {
            limit: (n: number) => { maybeSingle: () => Promise<{ data: unknown }> };
          };
        };
      };
    };
  })
    .from("semesters")
    .select("id, name, term, year, registration_opens_at, registration_closes_at")
    .gt("registration_opens_at", nowIso)
    .order("registration_opens_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const nrow = nextRow as {
    id: string;
    name: string;
    term: string;
    year: number;
    registration_opens_at: string | null;
    registration_closes_at: string | null;
  } | null;
  if (nrow) return { ...nrow, window_open: false };

  // 3. Fallback: current semester so the UI has context.
  const { data: curRow } = await (supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (k: string, v: unknown) => { maybeSingle: () => Promise<{ data: unknown }> };
      };
    };
  })
    .from("semesters")
    .select("id, name, term, year, registration_opens_at, registration_closes_at")
    .eq("is_current", true)
    .maybeSingle();

  const c = curRow as {
    id: string;
    name: string;
    term: string;
    year: number;
    registration_opens_at: string | null;
    registration_closes_at: string | null;
  } | null;
  if (!c) return null;
  const nowMs = Date.now();
  const window_open =
    !!c.registration_opens_at &&
    !!c.registration_closes_at &&
    Date.parse(c.registration_opens_at) <= nowMs &&
    Date.parse(c.registration_closes_at) >= nowMs;
  return { ...c, window_open };
}

export const listRegistrationOfferings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    semester: RegistrationSemester | null;
    offerings: OfferingRow[];
    serverNow: string;
  }> => {
    const { supabase, userId } = context;
    const semester = await pickRegistrationSemester(supabase as never);
    if (!semester) return { semester: null, offerings: [], serverNow: new Date().toISOString() };

    const { data: rawOfferings, error } = await supabase
      .from("course_offerings")
      .select(
        "id, section, capacity, instructor_user_id, course_id, courses!inner(id, code, title, credits, department_id)",
      )
      .eq("semester_id", semester.id);
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      section: string | null;
      capacity: number;
      instructor_user_id: string | null;
      course_id: string;
      courses: { id: string; code: string; title: string; credits: number; department_id: string };
    };
    const offerings = (rawOfferings ?? []) as unknown as Row[];
    if (offerings.length === 0)
      return { semester, offerings: [], serverNow: new Date().toISOString() };

    const offeringIds = offerings.map((o) => o.id);
    const instructorIds = Array.from(
      new Set(
        offerings
          .map((o) => o.instructor_user_id)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      ),
    );

    const [
      { data: approvedCounts },
      { data: enrolledCounts },
      { data: myRegs },
      { data: myEnrolls },
      { data: instructors },
    ] = await Promise.all([
      supabase
        .from("registrations")
        .select("course_offering_id")
        .eq("status", "APPROVED")
        .in("course_offering_id", offeringIds),
      supabase
        .from("enrollments")
        .select("course_offering_id, status")
        .in("course_offering_id", offeringIds)
        .in("status", ["ENROLLED", "COMPLETED"]),
      supabase
        .from("registrations")
        .select("course_offering_id, status")
        .eq("student_user_id", userId)
        .in("course_offering_id", offeringIds),
      supabase
        .from("enrollments")
        .select("course_offering_id")
        .eq("student_user_id", userId)
        .in("course_offering_id", offeringIds)
        .in("status", ["ENROLLED", "COMPLETED"]),
      instructorIds.length > 0
        ? supabase.from("profiles").select("id, full_name").in("id", instructorIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    ]);

    const takenMap = new Map<string, number>();
    for (const r of (approvedCounts ?? []) as { course_offering_id: string }[]) {
      takenMap.set(r.course_offering_id, (takenMap.get(r.course_offering_id) ?? 0) + 1);
    }
    for (const r of (enrolledCounts ?? []) as { course_offering_id: string }[]) {
      takenMap.set(r.course_offering_id, (takenMap.get(r.course_offering_id) ?? 0) + 1);
    }
    const myRegMap = new Map<string, "PENDING" | "APPROVED" | "REJECTED">();
    for (const r of (myRegs ?? []) as {
      course_offering_id: string;
      status: "PENDING" | "APPROVED" | "REJECTED";
    }[]) {
      // If multiple, prefer non-REJECTED.
      const prev = myRegMap.get(r.course_offering_id);
      if (!prev || (prev === "REJECTED" && r.status !== "REJECTED")) {
        myRegMap.set(r.course_offering_id, r.status);
      }
    }
    const myEnrollSet = new Set(
      ((myEnrolls ?? []) as { course_offering_id: string }[]).map((e) => e.course_offering_id),
    );
    const instructorMap = new Map(
      ((instructors ?? []) as { id: string; full_name: string | null }[]).map((p) => [
        p.id,
        p.full_name,
      ]),
    );

    const out: OfferingRow[] = offerings
      .map((o) => {
        const regStatus = myRegMap.get(o.id) ?? null;
        return {
          offeringId: o.id,
          courseId: o.course_id,
          code: o.courses.code,
          title: o.courses.title,
          credits: Number(o.courses.credits),
          section: o.section,
          capacity: o.capacity,
          taken: takenMap.get(o.id) ?? 0,
          instructorName: o.instructor_user_id
            ? instructorMap.get(o.instructor_user_id) ?? null
            : null,
          alreadyRegistered: regStatus === "PENDING" || regStatus === "APPROVED",
          registrationStatus: regStatus,
          alreadyEnrolled: myEnrollSet.has(o.id),
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    return { semester, offerings: out, serverNow: new Date().toISOString() };
  });

export const listMyRegistrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ registrations: MyRegistration[] }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("registrations")
      .select(
        `id, status, requested_at, decided_at, course_offering_id,
         course_offerings ( id, section,
           courses ( code, title, credits ),
           semesters ( name )
         )`,
      )
      .eq("student_user_id", userId)
      .order("requested_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      status: "PENDING" | "APPROVED" | "REJECTED";
      requested_at: string;
      decided_at: string | null;
      course_offerings: {
        id: string;
        section: string | null;
        courses: { code: string; title: string; credits: number };
        semesters: { name: string };
      } | null;
    };
    const rows = (data ?? []) as unknown as Row[];
    return {
      registrations: rows.map((r) => ({
        id: r.id,
        status: r.status,
        requested_at: r.requested_at,
        decided_at: r.decided_at,
        offering: r.course_offerings
          ? {
              offeringId: r.course_offerings.id,
              code: r.course_offerings.courses.code,
              title: r.course_offerings.courses.title,
              credits: Number(r.course_offerings.courses.credits),
              section: r.course_offerings.section,
              semesterName: r.course_offerings.semesters.name,
            }
          : null,
      })),
    };
  });

export const requestRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ courseOfferingId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string; registrationId?: string }> => {
    const { supabase, userId } = context;
    const { data: result, error } = await supabase.rpc("register_for_offering", {
      _student_user_id: userId,
      _course_offering_id: data.courseOfferingId,
    });
    if (error) return { ok: false, error: error.message };
    const r = result as { ok: boolean; error?: string; registration_id?: string };
    return { ok: r.ok, error: r.error, registrationId: r.registration_id };
  });
