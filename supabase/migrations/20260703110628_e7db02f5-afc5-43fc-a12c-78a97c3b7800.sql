
CREATE TABLE public.auth_rate_limits (
  email text PRIMARY KEY,
  attempt_count integer NOT NULL DEFAULT 0,
  first_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.auth_rate_limits TO service_role;
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_auth_rate_limits_updated_at
BEFORE UPDATE ON public.auth_rate_limits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.password_reset_tokens TO service_role;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_password_reset_tokens_user ON public.password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires ON public.password_reset_tokens(expires_at);

CREATE TABLE public.mfa_totp_secrets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secret text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  backup_codes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mfa_totp_secrets TO authenticated;
GRANT ALL ON public.mfa_totp_secrets TO service_role;
ALTER TABLE public.mfa_totp_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own mfa status"
  ON public.mfa_totp_secrets FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_mfa_totp_secrets_updated_at
BEFORE UPDATE ON public.mfa_totp_secrets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: is _user_id a department_head of the department with the given code?
CREATE OR REPLACE FUNCTION public.is_department_head_of(_user_id uuid, _department_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = _user_id
      AND ur.role = 'department_head'
      AND p.department = _department_code
  )
$$;
