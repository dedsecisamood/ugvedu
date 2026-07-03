-- Extend profiles with contact fields for the Profile page
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

-- Format validation (soft: null OR reasonable phone / length limits)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_format,
  DROP CONSTRAINT IF EXISTS profiles_emergency_phone_format,
  DROP CONSTRAINT IF EXISTS profiles_address_len,
  DROP CONSTRAINT IF EXISTS profiles_emergency_name_len;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_format
    CHECK (phone IS NULL OR phone ~ '^\+?[0-9 ()-]{7,20}$'),
  ADD CONSTRAINT profiles_emergency_phone_format
    CHECK (emergency_contact_phone IS NULL OR emergency_contact_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  ADD CONSTRAINT profiles_address_len
    CHECK (address IS NULL OR char_length(address) <= 500),
  ADD CONSTRAINT profiles_emergency_name_len
    CHECK (emergency_contact_name IS NULL OR char_length(emergency_contact_name) <= 100);

-- Avatars storage bucket for photo uploads. Private bucket; served via signed URL or public policy.
-- We create as public so photos can render via /storage/v1/object/public/... without extra plumbing.
