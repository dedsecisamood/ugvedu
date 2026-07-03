/**
 * /lab-projects — list assignments per course offering, with the caller's
 * submission status attached (if they are a student).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  encodeCursor, decodeCursor, cursorSchema, pageSizeSchema, type PageEnvelope,
  type ApiRow,
} from "./pagination";

const listInput = z.object({
  courseOfferingId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  cursor: cursorSchema,
  pageSize: pageSizeSchema,
});

export const listLabProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => listInput.parse(raw))
  .handler(async ({ data, context }): Promise<PageEnvelope<ApiRow>> => {
    const { supabase, userId } = context;

    let offeringIds: string[] | null = null;
    if (data.courseOfferingId) offeringIds = [data.courseOfferingId];
    else if (data.courseId) {
      const { data: offs } = await supabase
        .from("course_offerings").select("id").eq("course_id", data.courseId);
      offeringIds = offs?.map((o) => o.id) ?? [];
      if (offeringIds.length === 0) return { data: [], nextCursor: null, total: 0 };
    }

    let q = supabase
      .from("lab_projects")
      .select("id, course_offering_id, title, description, due_at, max_score, created_at", { count: "exact" });
    if (offeringIds) q = q.in("course_offering_id", offeringIds);

    const cur = decodeCursor(data.cursor);
    q = q.order("created_at", { ascending: false }).order("id", { ascending: false });
    if (cur) {
      q = q.or(`created_at.lt.${cur.createdAt},and(created_at.eq.${cur.createdAt},id.lt.${cur.id})`);
    }
    q = q.limit(data.pageSize + 1);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const hasMore = list.length > data.pageSize;
    const page = hasMore ? list.slice(0, data.pageSize) : list;

    // Attach caller submission status (only theirs — RLS keeps others invisible).
    const projectIds = page.map((r) => r.id);
    let submissionsByProject = new Map<string, Record<string, unknown>>();
    if (projectIds.length > 0) {
      const { data: subs } = await supabase
        .from("lab_submissions")
        .select("id, lab_project_id, submitted_at, score, storage_path")
        .in("lab_project_id", projectIds)
        .eq("student_user_id", userId);
      submissionsByProject = new Map((subs ?? []).map((s) => [s.lab_project_id, s]));
    }

    const enriched = page.map((r) => ({
      ...r,
      submission: submissionsByProject.get(r.id) ?? null,
    }));

    const last = page[page.length - 1];
    return {
      data: enriched,
      nextCursor: hasMore && last ? encodeCursor({ created_at: last.created_at, id: last.id }) : null,
      total: count ?? enriched.length,
    };
  });
