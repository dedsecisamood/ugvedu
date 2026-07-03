/**
 * Roles the current user holds — cached by the sidebar and used as a
 * client-side hint to render admin/faculty menus. Every privileged server
 * fn re-verifies its own role gate; this is UI hint only, not the fence.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "student" | "department_head" | "admin" | "registrar";

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ roles: AppRole[]; userId: string }> => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    return { roles: (data ?? []).map((r) => r.role as AppRole), userId };
  });
