
-- Day of week enum for routine
CREATE TYPE public.day_of_week AS ENUM ('SUN','MON','TUE','WED','THU','FRI','SAT');

-- Class schedules (routine)
CREATE TABLE public.class_schedules (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  day_of_week        public.day_of_week NOT NULL,
  start_time         TIME NOT NULL,
  end_time           TIME NOT NULL,
  room               TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX idx_class_schedules_offering ON public.class_schedules(course_offering_id);
CREATE INDEX idx_class_schedules_day_time ON public.class_schedules(day_of_week, start_time);
GRANT SELECT ON public.class_schedules TO authenticated;
GRANT ALL ON public.class_schedules TO service_role;
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_class_schedules_updated_at BEFORE UPDATE ON public.class_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY p_schedules_read ON public.class_schedules FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_schedules_write ON public.class_schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
         OR public.has_role(auth.uid(),'department_head'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
              OR public.has_role(auth.uid(),'department_head'));

-- Course materials (files/resources)
CREATE TABLE public.course_materials (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id          UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  course_offering_id UUID REFERENCES public.course_offerings(id) ON DELETE SET NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  storage_bucket     TEXT NOT NULL DEFAULT 'course-materials',
  storage_path       TEXT NOT NULL,
  file_size_bytes    BIGINT NOT NULL CHECK (file_size_bytes > 0),
  mime_type          TEXT NOT NULL,
  uploaded_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_course_materials_course ON public.course_materials(course_id);
CREATE INDEX idx_course_materials_offering ON public.course_materials(course_offering_id);
CREATE INDEX idx_course_materials_active ON public.course_materials(created_at DESC)
  WHERE deleted_at IS NULL;
GRANT SELECT ON public.course_materials TO authenticated;
GRANT ALL ON public.course_materials TO service_role;
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_course_materials_updated_at BEFORE UPDATE ON public.course_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY p_materials_read ON public.course_materials FOR SELECT TO authenticated
  USING (deleted_at IS NULL);
CREATE POLICY p_materials_write ON public.course_materials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
         OR public.has_role(auth.uid(),'department_head'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
              OR public.has_role(auth.uid(),'department_head'));

-- Lab projects
CREATE TABLE public.lab_projects (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  description        TEXT,
  due_at             TIMESTAMPTZ NOT NULL,
  max_score          NUMERIC(6,2) NOT NULL CHECK (max_score > 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lab_projects_offering ON public.lab_projects(course_offering_id);
CREATE INDEX idx_lab_projects_due ON public.lab_projects(due_at);
GRANT SELECT ON public.lab_projects TO authenticated;
GRANT ALL ON public.lab_projects TO service_role;
ALTER TABLE public.lab_projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_lab_projects_updated_at BEFORE UPDATE ON public.lab_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY p_lab_projects_read ON public.lab_projects FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY p_lab_projects_write ON public.lab_projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
         OR public.has_role(auth.uid(),'department_head'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
              OR public.has_role(auth.uid(),'department_head'));

-- Lab submissions
CREATE TABLE public.lab_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_project_id  UUID NOT NULL REFERENCES public.lab_projects(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES public.students(user_id) ON DELETE CASCADE,
  storage_bucket  TEXT NOT NULL DEFAULT 'lab-submissions',
  storage_path    TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  mime_type       TEXT NOT NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  score           NUMERIC(6,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lab_project_id, student_user_id)
);
CREATE INDEX idx_lab_submissions_project ON public.lab_submissions(lab_project_id);
CREATE INDEX idx_lab_submissions_student ON public.lab_submissions(student_user_id);
GRANT SELECT, INSERT, UPDATE ON public.lab_submissions TO authenticated;
GRANT ALL ON public.lab_submissions TO service_role;
ALTER TABLE public.lab_submissions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_lab_submissions_updated_at BEFORE UPDATE ON public.lab_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY p_lab_submissions_self_read ON public.lab_submissions FOR SELECT TO authenticated
  USING (auth.uid() = student_user_id);
CREATE POLICY p_lab_submissions_self_write ON public.lab_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_user_id);
CREATE POLICY p_lab_submissions_self_update ON public.lab_submissions FOR UPDATE TO authenticated
  USING (auth.uid() = student_user_id AND score IS NULL)
  WITH CHECK (auth.uid() = student_user_id AND score IS NULL);
CREATE POLICY p_lab_submissions_staff ON public.lab_submissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
         OR public.has_role(auth.uid(),'department_head'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
              OR public.has_role(auth.uid(),'department_head'));

-- Storage RLS for course-materials bucket (read for authenticated, write for staff)
CREATE POLICY p_storage_course_materials_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-materials');
CREATE POLICY p_storage_course_materials_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-materials'
              AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
                   OR public.has_role(auth.uid(),'department_head')));
CREATE POLICY p_storage_course_materials_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-materials'
         AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'registrar')
              OR public.has_role(auth.uid(),'department_head')));

-- Storage RLS for lab-submissions bucket (student-owned by path prefix = auth.uid()/...)
CREATE POLICY p_storage_lab_sub_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lab-submissions'
         AND ((storage.foldername(name))[1] = auth.uid()::text
              OR public.has_role(auth.uid(),'admin')
              OR public.has_role(auth.uid(),'registrar')
              OR public.has_role(auth.uid(),'department_head')));
CREATE POLICY p_storage_lab_sub_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lab-submissions'
              AND (storage.foldername(name))[1] = auth.uid()::text);
