/** Best-effort audit log writer. Never throws; audit failure must never break the primary action. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function writeAudit(
  supabase: SupabaseClient<Database>,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      user_id: userId, action, entity_type: entityType, entity_id: entityId, changes,
    });
  } catch { /* swallow */ }
}

export async function requireRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  roles: Array<Database["public"]["Enums"]["app_role"]>,
): Promise<boolean> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const set = new Set((data ?? []).map((r) => r.role));
  return roles.some((r) => set.has(r));
}
