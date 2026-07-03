
-- New enums
CREATE TYPE public.semester_term          AS ENUM ('SPRING', 'SUMMER', 'FALL');
CREATE TYPE public.course_type            AS ENUM ('THEORY', 'SESSIONAL');
CREATE TYPE public.enrollment_status      AS ENUM ('ENROLLED', 'DROPPED', 'COMPLETED', 'RETAKE');
CREATE TYPE public.semester_result_status AS ENUM ('GENERATED', 'BLOCKED');
CREATE TYPE public.registration_status    AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE public.payment_status         AS ENUM ('PAID', 'PARTIAL', 'OVERDUE');
CREATE TYPE public.student_status         AS ENUM ('ACTIVE', 'PROBATION', 'GRADUATED', 'SUSPENDED', 'DISMISSED');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Departments
CREATE TABLE public.departments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  code         TEXT NOT NULL UNIQUE,
  head_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_departments_head_user_id ON public.departments(head_user_id);
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Programs
CREATE TABLE public.programs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  department_id          UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  total_credits_required NUMERIC(6,2) NOT NULL CHECK (total_credits_required > 0),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, name)
);
CREATE INDEX idx_programs_department_id ON public.programs(department_id);
GRANT SELECT ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_programs_updated_at BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Semesters
CREATE TABLE public.semesters (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  term                   public.semester_term NOT NULL,
  year                   INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  is_current             BOOLEAN NOT NULL DEFAULT FALSE,
  registration_opens_at  TIMESTAMPTZ,
  registration_closes_at TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (term, year),
  CHECK (registration_closes_at IS NULL OR registration_opens_at IS NULL
         OR registration_closes_at > registration_opens_at)
);
CREATE UNIQUE INDEX uq_semesters_only_one_current
  ON public.semesters ((TRUE)) WHERE is_current = TRUE;
GRANT SELECT ON public.semesters TO authenticated;
GRANT ALL ON public.semesters TO service_role;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_semesters_updated_at BEFORE UPDATE ON public.semesters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Courses (soft-delete)
CREATE TABLE public.courses (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   TEXT NOT NULL UNIQUE,
  title                  TEXT NOT NULL,
  credits                NUMERIC(4,2) NOT NULL CHECK (credits > 0),
  department_id          UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  course_type            public.course_type NOT NULL,
  prerequisite_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  deleted_at             TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (prerequisite_course_id IS NULL OR prerequisite_course_id <> id)
);
CREATE INDEX idx_courses_department_id ON public.courses(department_id);
CREATE INDEX idx_courses_prerequisite  ON public.courses(prerequisite_course_id);
CREATE INDEX idx_courses_active        ON public.courses(id) WHERE deleted_at IS NULL;
GRANT SELECT ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grade scale (editable)
CREATE TABLE public.grade_scale (
  letter       TEXT PRIMARY KEY,
  min_percent  NUMERIC(5,2),
  max_percent  NUMERIC(5,2),
  grade_point  NUMERIC(4,2),
  is_fail      BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   INT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (min_percent IS NULL OR max_percent IS NULL OR max_percent >= min_percent)
);
GRANT SELECT ON public.grade_scale TO authenticated;
GRANT ALL ON public.grade_scale TO service_role;
ALTER TABLE public.grade_scale ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_grade_scale_updated_at BEFORE UPDATE ON public.grade_scale
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Students (soft-delete)
CREATE TABLE public.students (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id            TEXT NOT NULL UNIQUE,
  full_name             TEXT NOT NULL,
  photo_url             TEXT,
  department_id         UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  program_id            UUID NOT NULL REFERENCES public.programs(id)    ON DELETE RESTRICT,
  admission_semester_id UUID NOT NULL REFERENCES public.semesters(id)   ON DELETE RESTRICT,
  current_semester_id   UUID          REFERENCES public.semesters(id)   ON DELETE SET NULL,
  status                public.student_status NOT NULL DEFAULT 'ACTIVE',
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_department_id       ON public.students(department_id);
CREATE INDEX idx_students_program_id          ON public.students(program_id);
CREATE INDEX idx_students_current_semester_id ON public.students(current_semester_id);
CREATE INDEX idx_students_status_active       ON public.students(status) WHERE deleted_at IS NULL;
GRANT SELECT ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Course offerings
CREATE TABLE public.course_offerings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id          UUID NOT NULL REFERENCES public.courses(id)   ON DELETE RESTRICT,
  semester_id        UUID NOT NULL REFERENCES public.semesters(id) ON DELETE RESTRICT,
  instructor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  capacity           INT NOT NULL CHECK (capacity > 0),
  section            TEXT NOT NULL DEFAULT 'A',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, semester_id, section)
);
CREATE INDEX idx_course_offerings_course_id   ON public.course_offerings(course_id);
CREATE INDEX idx_course_offerings_semester_id ON public.course_offerings(semester_id);
CREATE INDEX idx_course_offerings_instructor  ON public.course_offerings(instructor_user_id);
GRANT SELECT ON public.course_offerings TO authenticated;
GRANT ALL ON public.course_offerings TO service_role;
ALTER TABLE public.course_offerings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_course_offerings_updated_at BEFORE UPDATE ON public.course_offerings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Registrations
CREATE TABLE public.registrations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id    UUID NOT NULL REFERENCES public.students(user_id) ON DELETE CASCADE,
  course_offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  status             public.registration_status NOT NULL DEFAULT 'PENDING',
  requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at         TIMESTAMPTZ,
  decided_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_registrations_student  ON public.registrations(student_user_id);
CREATE INDEX idx_registrations_offering ON public.registrations(course_offering_id);
CREATE INDEX idx_registrations_status   ON public.registrations(status);
CREATE UNIQUE INDEX uq_registrations_one_pending
  ON public.registrations(student_user_id, course_offering_id)
  WHERE status = 'PENDING';
GRANT SELECT, INSERT ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_registrations_updated_at BEFORE UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enrollments
CREATE TABLE public.enrollments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id    UUID NOT NULL REFERENCES public.students(user_id) ON DELETE CASCADE,
  course_offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  status             public.enrollment_status NOT NULL DEFAULT 'ENROLLED',
  enrolled_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_user_id, course_offering_id)
);
CREATE INDEX idx_enrollments_student  ON public.enrollments(student_user_id);
CREATE INDEX idx_enrollments_offering ON public.enrollments(course_offering_id);
CREATE INDEX idx_enrollments_status   ON public.enrollments(status);
GRANT SELECT ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_enrollments_updated_at BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grades
CREATE TABLE public.grades (
  enrollment_id        UUID PRIMARY KEY REFERENCES public.enrollments(id) ON DELETE CASCADE,
  letter_grade         TEXT NOT NULL REFERENCES public.grade_scale(letter) ON DELETE RESTRICT,
  is_fail              BOOLEAN NOT NULL DEFAULT FALSE,
  is_incomplete        BOOLEAN NOT NULL DEFAULT FALSE,
  published_at         TIMESTAMPTZ,
  published_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_grades_letter_grade ON public.grades(letter_grade);
CREATE INDEX idx_grades_published    ON public.grades(published_at);
GRANT SELECT ON public.grades TO authenticated;
GRANT ALL ON public.grades TO service_role;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_grades_updated_at BEFORE UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Semester results
CREATE TABLE public.semester_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES public.students(user_id) ON DELETE CASCADE,
  semester_id     UUID NOT NULL REFERENCES public.semesters(id)     ON DELETE RESTRICT,
  sgpa            NUMERIC(3,2),
  status          public.semester_result_status NOT NULL DEFAULT 'GENERATED',
  blocked_reason  TEXT,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_user_id, semester_id),
  CHECK (
    (status = 'BLOCKED'   AND sgpa IS NULL)
    OR (status = 'GENERATED' AND sgpa IS NOT NULL)
  )
);
CREATE INDEX idx_semester_results_student  ON public.semester_results(student_user_id);
CREATE INDEX idx_semester_results_semester ON public.semester_results(semester_id);
GRANT SELECT ON public.semester_results TO authenticated;
GRANT ALL ON public.semester_results TO service_role;
ALTER TABLE public.semester_results ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_semester_results_updated_at BEFORE UPDATE ON public.semester_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notices (soft-delete)
CREATE TABLE public.notices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT NOT NULL,
  body                 TEXT NOT NULL,
  target_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  target_semester_id   UUID REFERENCES public.semesters(id)   ON DELETE SET NULL,
  is_pinned            BOOLEAN NOT NULL DEFAULT FALSE,
  published_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notices_target_department ON public.notices(target_department_id);
CREATE INDEX idx_notices_target_semester   ON public.notices(target_semester_id);
CREATE INDEX idx_notices_active            ON public.notices(published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_notices_pinned            ON public.notices(is_pinned) WHERE is_pinned = TRUE AND deleted_at IS NULL;
GRANT SELECT ON public.notices TO authenticated;
GRANT ALL ON public.notices TO service_role;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_notices_updated_at BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payments
CREATE TABLE public.payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES public.students(user_id) ON DELETE RESTRICT,
  semester_id     UUID NOT NULL REFERENCES public.semesters(id)     ON DELETE RESTRICT,
  amount_due      NUMERIC(12,2) NOT NULL CHECK (amount_due >= 0),
  amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  due_date        DATE NOT NULL,
  status          public.payment_status NOT NULL DEFAULT 'OVERDUE',
  transaction_ref TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_user_id, semester_id)
);
CREATE INDEX idx_payments_student  ON public.payments(student_user_id);
CREATE INDEX idx_payments_semester ON public.payments(semester_id);
CREATE INDEX idx_payments_status   ON public.payments(status);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notifications
CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC) WHERE is_read = FALSE;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Audit log
CREATE TABLE public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  changes     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_entity  ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user    ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Helper: does the signed-in user own this enrollment?
CREATE OR REPLACE FUNCTION public.owns_enrollment(_user_id UUID, _enrollment_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.enrollments
                 WHERE id = _enrollment_id AND student_user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.owns_enrollment(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- RLS Policies
-- ============================================================================

CREATE POLICY p_departments_read  ON public.departments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_departments_write ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

CREATE POLICY p_programs_read  ON public.programs FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_programs_write ON public.programs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

CREATE POLICY p_semesters_read  ON public.semesters FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_semesters_write ON public.semesters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

CREATE POLICY p_courses_read ON public.courses FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));
CREATE POLICY p_courses_write ON public.courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

CREATE POLICY p_grade_scale_read  ON public.grade_scale FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_grade_scale_write ON public.grade_scale FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

CREATE POLICY p_students_self ON public.students FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY p_students_dept_head ON public.students FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'department_head')
         AND department_id IN (SELECT id FROM public.departments WHERE head_user_id = auth.uid()));
CREATE POLICY p_students_staff_all ON public.students FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));
CREATE POLICY p_students_write ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

CREATE POLICY p_offerings_read  ON public.course_offerings FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_offerings_write ON public.course_offerings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

CREATE POLICY p_registrations_self_read ON public.registrations FOR SELECT TO authenticated
  USING (auth.uid() = student_user_id);
CREATE POLICY p_registrations_self_insert ON public.registrations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_user_id AND status = 'PENDING');
CREATE POLICY p_registrations_staff ON public.registrations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
         OR public.has_role(auth.uid(),'department_head'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
              OR public.has_role(auth.uid(),'department_head'));

CREATE POLICY p_enrollments_self_read ON public.enrollments FOR SELECT TO authenticated
  USING (auth.uid() = student_user_id);
CREATE POLICY p_enrollments_staff ON public.enrollments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

CREATE POLICY p_grades_self_read ON public.grades FOR SELECT TO authenticated
  USING (public.owns_enrollment(auth.uid(), enrollment_id));
CREATE POLICY p_grades_staff ON public.grades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

CREATE POLICY p_semester_results_self ON public.semester_results FOR SELECT TO authenticated
  USING (auth.uid() = student_user_id);
CREATE POLICY p_semester_results_staff ON public.semester_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

CREATE POLICY p_notices_read ON public.notices FOR SELECT TO authenticated
  USING (deleted_at IS NULL);
CREATE POLICY p_notices_write ON public.notices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
         OR public.has_role(auth.uid(),'department_head'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
              OR public.has_role(auth.uid(),'department_head'));

CREATE POLICY p_payments_self ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = student_user_id);
CREATE POLICY p_payments_staff ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar'));

CREATE POLICY p_notifications_self_read   ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY p_notifications_self_update ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY p_audit_self ON public.audit_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
