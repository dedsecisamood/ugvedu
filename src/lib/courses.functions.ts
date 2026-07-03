/**
 * /courses server functions.
 *
 * - listCourses: any authenticated user; filter by department, semester (offering).
 * - getCourse: any authenticated user; returns detail + latest offering.
 * - getStudentCourses: strict self-scoping. A STUDENT may ONLY query their own
 *   userId. Cross-student access requires staff role. Enforced server-side.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  encodeCursor,
  decodeCursor,
  cursorSchema,
  pageSizeSchema,
  type PageEnvelope,
  type ApiRow,
} from "./pagination";

const listCoursesInput = z.object({
  departmentId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  cursor: cursorSchema,
  pageSize: pageSizeSchema,
});

export const listCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => listCoursesInput.parse(raw))
  .handler(async ({ data, context }): Promise<PageEnvelope<ApiRow>> => {
    const { supabase } = context;
    const cur = decodeCursor(data.cursor);

    let baseQuery = supabase
      .from("courses")
      .select("id, code, title, credits, course_type, department_id, prerequisite_course_id, created_at", { count: "exact" })
      .is("deleted_at", null);

    if (data.departmentId) baseQuery = baseQuery.eq("department_id", data.departmentId);
    if (data.search) baseQuery = baseQuery.or(`code.ilike.%${data.search}%,title.ilike.%${data.search}%`);
    if (data.semesterId) {
      const { data: offerings, error: offErr } = await supabase
        .from("course_offerings")
        .select("course_id")
        .eq("semester_id", data.semesterId);
      if (offErr) throw new Error(offErr.message);
      const ids = Array.from(new Set(offerings?.map((o) => o.course_id) ?? []));
      if (ids.length === 0) return { data: [], nextCursor: null, total: 0 };
      baseQuery = baseQuery.in("id", ids);
    }

    baseQuery = baseQuery.order("created_at", { ascending: false }).order("id", { ascending: false });
    if (cur) {
      baseQuery = baseQuery.or(
        `created_at.lt.${cur.createdAt},and(created_at.eq.${cur.createdAt},id.lt.${cur.id})`,
      );
    }
    baseQuery = baseQuery.limit(data.pageSize + 1);

    const { data: rows, error, count } = await baseQuery;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const hasMore = list.length > data.pageSize;
    const page = hasMore ? list.slice(0, data.pageSize) : list;
    const last = page[page.length - 1];
    return {
      data: page,
      nextCursor: hasMore && last ? encodeCursor({ created_at: last.created_at, id: last.id }) : null,
      total: count ?? page.length,
    };
  });

const getCourseInput = z.object({ id: z.string().uuid() });

export const getCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => getCourseInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: course, error } = await supabase
      .from("courses")
      .select("id, code, title, credits, course_type, department_id, prerequisite_course_id, created_at")
      .eq("id", data.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!course) throw new Error("Course not found");

    const { data: offerings } = await supabase
      .from("course_offerings")
      .select("id, section, capacity, instructor_user_id, semester_id, semesters(name, term, year, is_current)")
      .eq("course_id", data.id)
      .order("created_at", { ascending: false })
      .limit(10);

    return { ...course, offerings: offerings ?? [] };
  });

const getStudentCoursesInput = z.object({
  studentUserId: z.string().uuid(),
  semesterId: z.string().uuid().optional(),
  cursor: cursorSchema,
  pageSize: pageSizeSchema,
});

/** "My courses" — a STUDENT may only ever query their own user id. */
export const getStudentCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => getStudentCoursesInput.parse(raw))
  .handler(async ({ data, context }): Promise<PageEnvelope<ApiRow>> => {
    const { supabase, userId } = context;

    if (data.studentUserId !== userId) {
      // Only staff roles may cross-scope.
      const [{ data: isAdmin }, { data: isReg }, { data: isHead }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "registrar" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "department_head" }),
      ]);
      if (!isAdmin && !isReg && !isHead) {
        // Do not leak whether the target user exists.
        throw new Error("Forbidden");
      }
    }

    const cur = decodeCursor(data.cursor);
    let query = supabase
      .from("enrollments")
      .select(
        "id, status, enrolled_at, created_at, course_offerings(id, section, semester_id, semesters(name, term, year, is_current), courses(id, code, title, credits, course_type))",
        { count: "exact" },
      )
      .eq("student_user_id", data.studentUserId);

    if (data.semesterId) {
      const { data: offs } = await supabase
        .from("course_offerings")
        .select("id")
        .eq("semester_id", data.semesterId);
      const offIds = offs?.map((o) => o.id) ?? [];
      if (offIds.length === 0) return { data: [], nextCursor: null, total: 0 };
      query = query.in("course_offering_id", offIds);
    }

    query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
    if (cur) {
      query = query.or(
        `created_at.lt.${cur.createdAt},and(created_at.eq.${cur.createdAt},id.lt.${cur.id})`,
      );
    }
    query = query.limit(data.pageSize + 1);

    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const hasMore = list.length > data.pageSize;
    const page = hasMore ? list.slice(0, data.pageSize) : list;
    const last = page[page.length - 1];
    return {
      data: page,
      nextCursor: hasMore && last ? encodeCursor({ created_at: last.created_at, id: last.id }) : null,
      total: count ?? page.length,
    };
  });
