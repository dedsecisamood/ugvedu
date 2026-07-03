/**
 * Admin — user management & student intake.
 *
 * Every mutation re-checks the caller has `admin`. `supabaseAdmin` (service
 * role) is loaded lazily inside handlers because this module ships to the
 * client bundle as a server-fn stub.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "./roles.functions";

async function requireAdmin(supabase: import("@supabase/supabase-js").SupabaseClient, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = new Set((data ?? []).map((r: { role: string }) => r.role));
  if (!roles.has("admin")) throw new Error("Forbidden");
}

export type UserListRow = {
  userId: string;
  email: string | null;
  fullName: string | null;
  roles: AppRole[];
  studentId: string | null;
  departmentCode: string | null;
  isActive: boolean;
};

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserListRow[]> => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const ids = (users.users ?? []).map((u) => u.id);
    const [{ data: profiles }, { data: roleRows }, { data: students }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin
        .from("students")
        .select("user_id, student_id, departments(code)")
        .in("user_id", ids),
    ]);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of roleRows ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    }
    const studentByUser = new Map(
      (students ?? []).map((s) => [
        s.user_id,
        {
          studentId: s.student_id,
          deptCode: (s.departments as { code: string } | null)?.code ?? null,
        },
      ]),
    );
    return (users.users ?? []).map((u) => {
      const s = studentByUser.get(u.id);
      return {
        userId: u.id,
        email: u.email ?? null,
        fullName: profileMap.get(u.id) ?? null,
        roles: rolesByUser.get(u.id) ?? [],
        studentId: s?.studentId ?? null,
        departmentCode: s?.deptCode ?? null,
        isActive: !u.banned_until,
      };
    });
  });

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(1).max(200),
  role: z.enum(["student", "department_head", "admin", "registrar"]),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createUserSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) throw new Error(error.message);
    if (!created.user) throw new Error("User creation returned no user");
    // handle_new_user trigger inserts profiles + a default 'student' role.
    // If they asked for a different role, replace it.
    if (data.role !== "student") {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
      await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    }
    await context.supabase.from("audit_log").insert({
      user_id: context.userId, action: "user.create", entity_type: "user",
      entity_id: created.user.id, changes: { email: data.email, role: data.role },
    });
    return { userId: created.user.id };
  });

const roleMutationSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["student", "department_head", "admin", "registrar"]),
});

export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => roleMutationSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_log").insert({
      user_id: context.userId, action: "role.assign", entity_type: "user",
      entity_id: data.userId, changes: { role: data.role },
    });
    return { ok: true };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => roleMutationSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role === "admin") {
      throw new Error("You cannot revoke your own admin role.");
    }
    const { error } = await context.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_log").insert({
      user_id: context.userId, action: "role.revoke", entity_type: "user",
      entity_id: data.userId, changes: { role: data.role },
    });
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && !data.active) {
      throw new Error("You cannot deactivate your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h", // ~100 years = "deactivated"
    });
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_log").insert({
      user_id: context.userId,
      action: data.active ? "user.activate" : "user.deactivate",
      entity_type: "user", entity_id: data.userId, changes: {},
    });
    return { ok: true };
  });

// ---------- Student intake ----------

export type IntakeOptions = {
  departments: { id: string; code: string; name: string }[];
  programs: { id: string; name: string; departmentId: string }[];
  semesters: { id: string; name: string; term: string; year: number }[];
  unassignedUsers: { userId: string; email: string | null; fullName: string | null }[];
};

export const getIntakeOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntakeOptions> => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: depts }, { data: progs }, { data: sems }, { data: allStudents }, { data: users }] =
      await Promise.all([
        supabaseAdmin.from("departments").select("id, code, name").order("code"),
        supabaseAdmin.from("programs").select("id, name, department_id").order("name"),
        supabaseAdmin.from("semesters").select("id, name, term, year")
          .order("year", { ascending: false }).order("term"),
        supabaseAdmin.from("students").select("user_id"),
        supabaseAdmin.auth.admin.listUsers({ perPage: 200 }),
      ]);
    const studentIds = new Set((allStudents ?? []).map((s) => s.user_id));
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name");
    const profMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
    return {
      departments: depts ?? [],
      programs: (progs ?? []).map((p) => ({
        id: p.id, code: p.code, name: p.name, departmentId: p.department_id,
      })),
      semesters: sems ?? [],
      unassignedUsers: (users.users ?? [])
        .filter((u) => !studentIds.has(u.id))
        .map((u) => ({ userId: u.id, email: u.email ?? null, fullName: profMap.get(u.id) ?? null })),
    };
  });

const intakeSchema = z.object({
  userId: z.string().uuid(),
  studentId: z.string().trim().min(3).max(30),
  fullName: z.string().trim().min(1).max(200),
  departmentId: z.string().uuid(),
  programId: z.string().uuid(),
  admissionSemesterId: z.string().uuid(),
});

export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => intakeSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("students").insert({
      user_id: data.userId,
      student_id: data.studentId,
      full_name: data.fullName,
      department_id: data.departmentId,
      program_id: data.programId,
      admission_semester_id: data.admissionSemesterId,
      current_semester_id: data.admissionSemesterId,
      status: "ACTIVE",
    });
    if (error) throw new Error(error.message);
    // Keep profile.full_name in sync.
    await supabaseAdmin.from("profiles").update({ full_name: data.fullName }).eq("id", data.userId);
    await context.supabase.from("audit_log").insert({
      user_id: context.userId, action: "student.create", entity_type: "student",
      entity_id: data.userId, changes: { student_id: data.studentId },
    });
    return { ok: true };
  });
