-- Defense-in-depth: revoke EXECUTE from PUBLIC + anon on every SECURITY DEFINER
-- function in public.*. These functions already self-check auth (has_role,
-- is_head_of_student, etc.) or are unreachable without a session id, but the
-- Supabase linter and our security posture require they not be listed in the
-- anon role's exposed API.

-- Privileged write RPCs — must not be callable without a session.
REVOKE EXECUTE ON FUNCTION public.register_for_offering(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.publish_offering_grades(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_incomplete_grade(uuid, text, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.register_for_offering(uuid, uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.publish_offering_grades(uuid, uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.resolve_incomplete_grade(uuid, text, uuid, text) TO authenticated, service_role;

-- Internal RLS-support helpers — used only inside SECURITY DEFINER policies
-- and by server code holding a session/bearer. Revoke anon EXECUTE.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_department_head_of(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_head_of_student(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_enrollment(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.is_department_head_of(uuid, text) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.is_head_of_student(uuid, uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.owns_enrollment(uuid, uuid) TO authenticated, service_role;

-- Notification/trigger helpers — never meant to be user-callable.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fanout_notice_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_result_unblocked() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_registration_decision() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;