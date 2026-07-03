/**
 * Example role-guarded server function.
 *
 * Access rules for reading a student's semester results:
 *   - STUDENT           : may read only their own results
 *   - DEPARTMENT_HEAD   : may read results of students in their own department only
 *   - REGISTRAR / ADMIN : may read any student's results
 *
 * All checks happen server-side. RLS is an additional defence layer;
 * we do NOT rely on the UI hiding data.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const paramsSchema = z.object({ studentUserId: z.string().uuid() });

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const getStudentSemesterResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => paramsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Roles held by the caller.
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = new Set((roleRows ?? []).map((r) => r.role));

    // Target student's department.
    const { data: target } = await supabase
      .from("students")
      .select("user_id, department_id, departments(code)")
      .eq("user_id", data.studentUserId)
      .maybeSingle();
    if (!target) throw new HttpError(404, "Student not found");

    const isSelf = data.studentUserId === userId;
    const isPrivileged = roles.has("admin") || roles.has("registrar");
    let allowed = isSelf || isPrivileged;

    if (!allowed && roles.has("department_head")) {
      const targetCode = (target as { departments: { code: string } | null }).departments?.code;
      if (targetCode) {
        const { data: allowedDept } = await supabase.rpc("is_department_head_of", {
          _user_id: userId,
          _department_code: targetCode,
        });
        allowed = allowedDept === true;
      }
    }

    if (!allowed) throw new HttpError(403, "Forbidden");

    const { data: results, error } = await supabase
      .from("semester_results")
      .select("*")
      .eq("student_user_id", data.studentUserId)
      .order("semester_id");
    if (error) throw new HttpError(500, error.message);

    return { results: results ?? [] };
  });
