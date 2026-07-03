/**
 * GET /api/lab-projects?courseOfferingId=<uuid> — list assignments/projects.
 * Each row includes the caller's own submission (if any) via RLS-filtered join.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, jsonError } from "@/lib/api-http";
import {
  encodeCursor, decodeCursor, cursorSchema, pageSizeSchema,
} from "@/lib/pagination";

const query = z.object({
  courseOfferingId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  cursor: cursorSchema,
  pageSize: pageSizeSchema,
});

export const Route = createFileRoute("/api/lab-projects/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;

        const url = new URL(request.url);
        const parsed = query.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) return jsonError(400, "Invalid query", { issues: parsed.error.issues });
        const p = parsed.data;

        let offeringIds: string[] | null = null;
        if (p.courseOfferingId) offeringIds = [p.courseOfferingId];
        else if (p.courseId) {
          const { data: offs } = await ctx.supabase.from("course_offerings").select("id").eq("course_id", p.courseId);
          offeringIds = offs?.map((o) => o.id) ?? [];
          if (offeringIds.length === 0) return Response.json({ data: [], nextCursor: null, total: 0 });
        }

        let q = ctx.supabase
          .from("lab_projects")
          .select("id, course_offering_id, title, description, due_at, max_score, created_at", { count: "exact" });
        if (offeringIds) q = q.in("course_offering_id", offeringIds);

        const cur = decodeCursor(p.cursor);
        q = q.order("created_at", { ascending: false }).order("id", { ascending: false });
        if (cur) q = q.or(`created_at.lt.${cur.createdAt},and(created_at.eq.${cur.createdAt},id.lt.${cur.id})`);
        q = q.limit(p.pageSize + 1);

        const { data: rows, error, count } = await q;
        if (error) return jsonError(500, error.message);
        const list = rows ?? [];
        const hasMore = list.length > p.pageSize;
        const page = hasMore ? list.slice(0, p.pageSize) : list;

        const ids = page.map((r) => r.id);
        let subMap = new Map<string, unknown>();
        if (ids.length > 0) {
          const { data: subs } = await ctx.supabase
            .from("lab_submissions")
            .select("id, lab_project_id, submitted_at, score, storage_path")
            .in("lab_project_id", ids)
            .eq("student_user_id", ctx.userId);
          subMap = new Map((subs ?? []).map((s) => [s.lab_project_id, s]));
        }

        const enriched = page.map((r) => ({ ...r, submission: subMap.get(r.id) ?? null }));
        const last = page[page.length - 1];
        return Response.json({
          data: enriched,
          nextCursor: hasMore && last ? encodeCursor({ created_at: last.created_at, id: last.id }) : null,
          total: count ?? enriched.length,
        });
      },
    },
  },
});
