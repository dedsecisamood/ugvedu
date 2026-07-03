
REVOKE EXECUTE ON FUNCTION public.is_department_head_of(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_department_head_of(uuid, text) TO authenticated, service_role;

CREATE POLICY "Deny all client access" ON public.auth_rate_limits
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Deny all client access" ON public.password_reset_tokens
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
