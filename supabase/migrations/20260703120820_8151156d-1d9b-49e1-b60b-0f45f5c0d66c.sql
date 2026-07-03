
-- 1. Notice reads (per-user tracking)
CREATE TABLE public.notice_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notice_id)
);
GRANT SELECT, INSERT, DELETE ON public.notice_reads TO authenticated;
GRANT ALL ON public.notice_reads TO service_role;
ALTER TABLE public.notice_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reads" ON public.notice_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2. Payment webhook idempotency log
CREATE TABLE public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_ref text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'sslcommerz',
  status text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read webhook log" ON public.payment_webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'registrar'));

-- 3. Ensure payments.transaction_ref is unique when present (idempotency key)
CREATE UNIQUE INDEX IF NOT EXISTS payments_transaction_ref_key
  ON public.payments (transaction_ref) WHERE transaction_ref IS NOT NULL;

-- 4. Transaction-safe registration RPC
CREATE OR REPLACE FUNCTION public.register_for_offering(
  _student_user_id uuid,
  _course_offering_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offering RECORD;
  v_semester RECORD;
  v_course RECORD;
  v_enrolled_count int;
  v_prereq_ok boolean;
  v_registration_id uuid;
BEGIN
  -- Lock the offering row to serialize capacity checks
  SELECT co.id, co.course_id, co.semester_id, co.capacity
    INTO v_offering
    FROM public.course_offerings co
   WHERE co.id = _course_offering_id
   FOR UPDATE;
  IF v_offering.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Offering not found');
  END IF;

  SELECT * INTO v_semester FROM public.semesters WHERE id = v_offering.semester_id;
  IF v_semester.registration_opens_at IS NULL OR now() < v_semester.registration_opens_at
     OR v_semester.registration_closes_at IS NULL OR now() > v_semester.registration_closes_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Registration window is closed');
  END IF;

  SELECT * INTO v_course FROM public.courses WHERE id = v_offering.course_id;

  -- Duplicate registration check (PENDING or APPROVED counts)
  IF EXISTS (
    SELECT 1 FROM public.registrations
     WHERE student_user_id = _student_user_id
       AND course_offering_id = _course_offering_id
       AND status IN ('PENDING','APPROVED')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already registered for this offering');
  END IF;

  -- Already enrolled?
  IF EXISTS (
    SELECT 1 FROM public.enrollments e
     WHERE e.student_user_id = _student_user_id
       AND e.course_offering_id = _course_offering_id
       AND e.status IN ('ENROLLED','COMPLETED')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already enrolled in this offering');
  END IF;

  -- Prerequisite check: student must have COMPLETED enrollment with passing grade
  IF v_course.prerequisite_course_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.enrollments e
      JOIN public.course_offerings co2 ON co2.id = e.course_offering_id
      JOIN public.grades g ON g.enrollment_id = e.id
     WHERE e.student_user_id = _student_user_id
       AND co2.course_id = v_course.prerequisite_course_id
       AND e.status = 'COMPLETED'
       AND g.published_at IS NOT NULL
       AND g.is_fail = false
       AND g.is_incomplete = false
    ) INTO v_prereq_ok;
    IF NOT v_prereq_ok THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Prerequisite not completed');
    END IF;
  END IF;

  -- Capacity check: count APPROVED + already-enrolled + PENDING(? no) — approved holds a seat
  SELECT count(*) INTO v_enrolled_count
    FROM public.registrations
   WHERE course_offering_id = _course_offering_id
     AND status = 'APPROVED';
  v_enrolled_count := v_enrolled_count + (
    SELECT count(*) FROM public.enrollments
     WHERE course_offering_id = _course_offering_id
       AND status IN ('ENROLLED','COMPLETED')
  );
  IF v_enrolled_count >= v_offering.capacity THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Course is full');
  END IF;

  -- Auto-approve: create APPROVED registration + enrollment atomically.
  -- (Manual approval flow can PATCH later; auto-approve keeps capacity honest.)
  INSERT INTO public.registrations (student_user_id, course_offering_id, status, decided_at)
    VALUES (_student_user_id, _course_offering_id, 'APPROVED', now())
    RETURNING id INTO v_registration_id;

  INSERT INTO public.enrollments (student_user_id, course_offering_id, status)
    VALUES (_student_user_id, _course_offering_id, 'ENROLLED');

  RETURN jsonb_build_object('ok', true, 'registration_id', v_registration_id);
END;
$$;
REVOKE ALL ON FUNCTION public.register_for_offering(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.register_for_offering(uuid, uuid) TO authenticated, service_role;

-- 5. Atomic grade publish RPC — flips published_at on all draft grades for an
-- offering and returns the (student, semester) pairs that need recalculation.
CREATE OR REPLACE FUNCTION public.publish_offering_grades(
  _course_offering_id uuid,
  _published_by uuid
) RETURNS TABLE(student_user_id uuid, semester_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Lock the offering; a concurrent publish must wait.
  PERFORM 1 FROM public.course_offerings WHERE id = _course_offering_id FOR UPDATE;

  UPDATE public.grades g
     SET published_at = now(),
         published_by_user_id = _published_by
    FROM public.enrollments e
   WHERE g.enrollment_id = e.id
     AND e.course_offering_id = _course_offering_id
     AND g.published_at IS NULL;

  -- Mark enrollments COMPLETED
  UPDATE public.enrollments e
     SET status = 'COMPLETED'
    FROM public.grades g
   WHERE g.enrollment_id = e.id
     AND e.course_offering_id = _course_offering_id
     AND g.published_at IS NOT NULL
     AND e.status = 'ENROLLED';

  RETURN QUERY
    SELECT DISTINCT e.student_user_id, co.semester_id
      FROM public.enrollments e
      JOIN public.course_offerings co ON co.id = e.course_offering_id
     WHERE co.id = _course_offering_id;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_offering_grades(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.publish_offering_grades(uuid, uuid) TO authenticated, service_role;

-- 6. Notification triggers

-- 6a. On notice publish: fan out to every user in the target audience.
CREATE OR REPLACE FUNCTION public.fanout_notice_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.published_at IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, title, body)
  SELECT s.user_id, 'Notice: ' || NEW.title, left(NEW.body, 200)
    FROM public.students s
   WHERE s.deleted_at IS NULL
     AND (NEW.target_department_id IS NULL OR s.department_id = NEW.target_department_id)
     AND (NEW.target_semester_id IS NULL OR s.current_semester_id = NEW.target_semester_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notice_fanout ON public.notices;
CREATE TRIGGER trg_notice_fanout AFTER INSERT ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.fanout_notice_notifications();

-- 6b. On registration decision change: notify student.
CREATE OR REPLACE FUNCTION public.notify_registration_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('APPROVED','REJECTED')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.student_user_id,
            'Registration ' || NEW.status,
            'Your registration request was ' || lower(NEW.status) || '.');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_registration_notify ON public.registrations;
CREATE TRIGGER trg_registration_notify AFTER INSERT OR UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.notify_registration_decision();

-- 6c. On semester_result flipping BLOCKED -> GENERATED.
CREATE OR REPLACE FUNCTION public.notify_result_unblocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'BLOCKED' AND NEW.status = 'GENERATED' THEN
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.student_user_id, 'Result published',
            'Your semester result is now available.');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_result_unblocked ON public.semester_results;
CREATE TRIGGER trg_result_unblocked AFTER UPDATE ON public.semester_results
  FOR EACH ROW EXECUTE FUNCTION public.notify_result_unblocked();

-- 7. RLS for notifications — user reads own only
DROP POLICY IF EXISTS "own notifications read" ON public.notifications;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "own notifications update" ON public.notifications;
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
