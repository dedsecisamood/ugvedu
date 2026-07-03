/**
 * Admin CRUD for the grade scale, semester registration windows, and a
 * read-only audit log viewer with basic filters. Each mutation re-checks
 * the caller has admin/registrar; UI is admin-only per sidebar.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireStaff(supabase: import("@supabase/supabase-js").SupabaseClient, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = new Set((data ?? []).map((r: { role: string }) => r.role));
  if (!roles.has("admin") && !roles.has("registrar")) throw new Error("Forbidden");
}

// ---------- Grade Scale ----------

export type GradeScaleRow = {
  letter: string; gradePoint: number | null; isFail: boolean;
  minPercent: number | null; maxPercent: number | null; sortOrder: number;
};

export const listGradeScale = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GradeScaleRow[]> => {
    const { data, error } = await context.supabase
      .from("grade_scale")
      .select("letter, grade_point, is_fail, min_percent, max_percent, sort_order")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      letter: r.letter,
      gradePoint: r.grade_point === null ? null : Number(r.grade_point),
      isFail: r.is_fail,
      minPercent: r.min_percent === null ? null : Number(r.min_percent),
      maxPercent: r.max_percent === null ? null : Number(r.max_percent),
      sortOrder: r.sort_order,
    }));
  });

const gsSchema = z.object({
  letter: z.string().trim().min(1).max(3),
  gradePoint: z.number().min(0).max(4).nullable(),
  isFail: z.boolean(),
  minPercent: z.number().min(0).max(100).nullable(),
  maxPercent: z.number().min(0).max(100).nullable(),
  sortOrder: z.number().int().min(0).max(999),
});

export const upsertGradeScale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => gsSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("grade_scale").upsert({
      letter: data.letter.toUpperCase(),
      grade_point: data.gradePoint,
      is_fail: data.isFail,
      min_percent: data.minPercent,
      max_percent: data.maxPercent,
      sort_order: data.sortOrder,
    }, { onConflict: "letter" });
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_log").insert({
      user_id: context.userId, action: "grade_scale.upsert",
      entity_type: "grade_scale", entity_id: data.letter.toUpperCase(), changes: data,
    });
    return { ok: true };
  });

export const deleteGradeScale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ letter: z.string().min(1).max(3) }).parse(input))
  .handler(async ({ context, data }) => {
    await requireStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("grade_scale").delete().eq("letter", data.letter.toUpperCase());
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_log").insert({
      user_id: context.userId, action: "grade_scale.delete",
      entity_type: "grade_scale", entity_id: data.letter.toUpperCase(), changes: {},
    });
    return { ok: true };
  });

// ---------- Semesters ----------

export type SemesterAdminRow = {
  id: string; name: string; term: string; year: number;
  isCurrent: boolean;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
};

export const listSemesters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SemesterAdminRow[]> => {
    const { data, error } = await context.supabase
      .from("semesters")
      .select("id, name, term, year, is_current, registration_opens_at, registration_closes_at")
      .order("year", { ascending: false })
      .order("term");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id, name: r.name, term: r.term, year: r.year, isCurrent: r.is_current,
      registrationOpensAt: r.registration_opens_at, registrationClosesAt: r.registration_closes_at,
    }));
  });

const semSchema = z.object({
  id: z.string().uuid(),
  registrationOpensAt: z.string().datetime().nullable(),
  registrationClosesAt: z.string().datetime().nullable(),
});

export const updateSemesterWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => semSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("semesters")
      .update({
        registration_opens_at: data.registrationOpensAt,
        registration_closes_at: data.registrationClosesAt,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_log").insert({
      user_id: context.userId, action: "semester.update_window",
      entity_type: "semester", entity_id: data.id, changes: data,
    });
    return { ok: true };
  });

// ---------- Audit log viewer ----------

const auditQuerySchema = z.object({
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(100).optional(),
  userId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(200).default(100),
});

// Use `any` for the JSON payload — TanStack's server-fn serializer rejects
// index signatures typed as `unknown`, and the audit changes column is Json.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AuditChangesJson = any;
export type AuditRow = {
  id: string; createdAt: string; userId: string | null; action: string;
  entityType: string; entityId: string;
  actor: { fullName: string | null; email: string | null } | null;
  changes: AuditChangesJson;
};

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => auditQuerySchema.parse(input ?? {}))
  .handler(async ({ context, data }): Promise<AuditRow[]> => {
    // Admin-only.
    const { data: roleRows } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roleRows ?? []).some((r) => r.role === "admin")) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("audit_log")
      .select("id, created_at, user_id, action, entity_type, entity_id, changes")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.action) q = q.eq("action", data.action);
    if (data.entityType) q = q.eq("entity_type", data.entityType);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))) as string[];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] };
    const { data: users } = ids.length
      ? await supabaseAdmin.auth.admin.listUsers({ perPage: 200 })
      : { data: { users: [] } };
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const umap = new Map((users.users ?? []).map((u) => [u.id, u.email ?? null]));

    return (rows ?? []).map((r) => ({
      id: r.id, createdAt: r.created_at, userId: r.user_id, action: r.action,
      entityType: r.entity_type, entityId: r.entity_id,
      actor: r.user_id ? { fullName: pmap.get(r.user_id) ?? null, email: umap.get(r.user_id) ?? null } : null,
      changes: (r.changes as Record<string, unknown>) ?? {},
    }));
  });
