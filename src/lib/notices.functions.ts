/**
 * Notices — page-facing server fns.
 * - listMyNotices: pinned first, RLS + explicit dept/semester scoping.
 * - markNoticeRead: idempotent upsert into notice_reads (per-user).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NoticeRow = {
  id: string;
  title: string;
  body: string;
  target_department_id: string | null;
  target_semester_id: string | null;
  is_pinned: boolean;
  published_at: string | null;
  created_at: string;
  is_read: boolean;
  department_name: string | null;
  department_code: string | null;
};

export const listMyNotices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ notices: NoticeRow[] }> => {
    const { supabase, userId } = context;

    const { data: student } = await supabase
      .from("students")
      .select("department_id, current_semester_id")
      .eq("user_id", userId)
      .maybeSingle();

    let q = supabase
      .from("notices")
      .select(
        "id, title, body, target_department_id, target_semester_id, is_pinned, published_at, created_at, departments:target_department_id(name, code)",
      )
      .is("deleted_at", null)
      .not("published_at", "is", null)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(200);

    if (student) {
      const deptId = student.department_id ?? "00000000-0000-0000-0000-000000000000";
      const semId = student.current_semester_id ?? "00000000-0000-0000-0000-000000000000";
      q = q
        .or(`target_department_id.is.null,target_department_id.eq.${deptId}`)
        .or(`target_semester_id.is.null,target_semester_id.eq.${semId}`);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const { data: reads } = await supabase
      .from("notice_reads")
      .select("notice_id")
      .eq("user_id", userId);
    const readSet = new Set((reads ?? []).map((r) => r.notice_id));

    type Row = {
      id: string;
      title: string;
      body: string;
      target_department_id: string | null;
      target_semester_id: string | null;
      is_pinned: boolean;
      published_at: string | null;
      created_at: string;
      departments: { name: string; code: string } | null;
    };
    const rows = (data ?? []) as unknown as Row[];
    return {
      notices: rows.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        target_department_id: n.target_department_id,
        target_semester_id: n.target_semester_id,
        is_pinned: n.is_pinned,
        published_at: n.published_at,
        created_at: n.created_at,
        is_read: readSet.has(n.id),
        department_name: n.departments?.name ?? null,
        department_code: n.departments?.code ?? null,
      })),
    };
  });

export const markNoticeRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ noticeId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notice_reads")
      .upsert(
        { user_id: context.userId, notice_id: data.noticeId },
        { onConflict: "user_id,notice_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
