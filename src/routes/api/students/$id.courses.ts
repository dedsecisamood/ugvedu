/**
 * GET /api/students/$id/courses — "My Courses" for a student.
 * A STUDENT may only query their own userId. Cross-scope requires staff role.
 * Enforced server-side; UI cannot bypass.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, jsonError } from "@/lib/api-http";
import {
  encodeCursor, decodeCursor, cursorSchema, pageSizeSchema,
} from "@/lib/pagination";

const query = z.object({
  semesterId: z.string().uuid().optional(),
  cursor: cursorSchema,
  pageSize: pageSizeSchema,
});

export const Route = createFileRoute("/api/students/$id/courses")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const idParsed = z.string().uuid().safeParse(params.id);
        if (!idParsed.success) return jsonError(400, "Invalid student id");

        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;

        if (idParsed.data !== ctx.userId) {
          const [{ data: a }, { data: r }, { data: h }] = await Promise.all([
            ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
            ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "registrar" }),
            ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "department_head" }),
          ]);
          if (!a && !r && !h) return jsonError(403, "Forbidden");
        }

        const url = new URL(request.url);
        const parsed = query.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) return jsonError(400, "Invalid query", { issues: parsed.error.issues });
        const p = parsed.data;

        let q = ctx.supabase
          .from("enrollments")
          .select(
            "id, status, enrolled_at, created_at, course_offerings(id, section, semester_id, semesters(name, term, year, is_current), courses(id, code, title, credits, course_type))",
            { count: "exact" },
          )
          .eq("student_user_id", idParsed.data);

        if (p.semesterId) {
          const { data: offs } = await ctx.supabase.from("course_offerings").select("id").eq("semester_id", p.semesterId);
          const ids = offs?.map((o) => o.id) ?? [];
          if (ids.length === 0) return Response.json({ data: [], nextCursor: null, total: 0 });
          q = q.in("course_offering_id", ids);
        }

        const cur = decodeCursor(p.cursor);
        q = q.order("created_at", { ascending: false }).order("id", { ascending: false });
        if (cur) q = q.or(`created_at.lt.${cur.createdAt},and(created_at.eq.${cur.createdAt},id.lt.${cur.id})`);
        q = q.limit(p.pageSize + 1);

        const { data: rows, error, count } = await q;
        if (error) return jsonError(500, error.message);
        const list = rows ?? [];
        const hasMore = list.length > p.pageSize;
        const page = hasMore ? list.slice(0, p.pageSize) : list;
        const last = page[page.length - 1];
        return Response.json({
          data: page,
          nextCursor: hasMore && last ? encodeCursor({ created_at: last.created_at, id: last.id }) : null,
          total: count ?? page.length,
        });
      },
    },
  },
});
