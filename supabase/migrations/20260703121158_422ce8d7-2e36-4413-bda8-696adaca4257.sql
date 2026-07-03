CREATE OR REPLACE FUNCTION public.notify_registration_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('APPROVED','REJECTED')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.student_user_id,
            'Registration ' || NEW.status::text,
            'Your registration request was ' || lower(NEW.status::text) || '.');
  END IF;
  RETURN NEW;
END;
$$;