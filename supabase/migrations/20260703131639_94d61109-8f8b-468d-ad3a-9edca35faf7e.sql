
-- Helper: is `_head_user` the department head of the student `_student_user`?
CREATE OR REPLACE FUNCTION public.is_head_of_student(_head_user uuid, _student_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.departments d ON d.id = s.department_id
    WHERE s.user_id = _student_user
      AND d.head_user_id = _head_user
      AND public.has_role(_head_user, 'department_head'::app_role)
  )
$$;

-- Department heads may read students, enrollments, grades, semester_results,
-- and registrations for students in their department. Read-only; edits still
-- flow through server-side functions with explicit authorization checks.
CREATE POLICY p_students_dept_head_all ON public.students
  FOR SELECT TO authenticated
  USING (public.is_head_of_student(auth.uid(), user_id));

CREATE POLICY p_enrollments_dept_head_read ON public.enrollments
  FOR SELECT TO authenticated
  USING (public.is_head_of_student(auth.uid(), student_user_id));

CREATE POLICY p_grades_dept_head_read ON public.grades
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.id = enrollment_id
        AND public.is_head_of_student(auth.uid(), e.student_user_id)
    )
  );

CREATE POLICY p_semester_results_dept_head_read ON public.semester_results
  FOR SELECT TO authenticated
  USING (public.is_head_of_student(auth.uid(), student_user_id));

CREATE POLICY p_registrations_dept_head_read ON public.registrations
  FOR SELECT TO authenticated
  USING (public.is_head_of_student(auth.uid(), student_user_id));

-- Admins may write user_roles from the client (needed for role assignment UI).
CREATE POLICY p_user_roles_admin_write ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Atomic "resolve an Incomplete" — dept_head of the student's department (or
-- admin) may replace an I grade with a real letter. The grade is re-published
-- with the caller as `published_by_user_id` and an audit row is written.
-- Recalculation of semester_results happens in a follow-up server fn call
-- so it can reuse the existing pure GPA engine + grade_scale join.
CREATE OR REPLACE FUNCTION public.resolve_incomplete_grade(
  _enrollment_id uuid,
  _new_letter    text,
  _resolver      uuid,
  _note          text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_student   uuid;
  v_scale     RECORD;
  v_existing  RECORD;
  v_semester  uuid;
BEGIN
  SELECT e.student_user_id, co.semester_id
    INTO v_student, v_semester
    FROM public.enrollments e
    JOIN public.course_offerings co ON co.id = e.course_offering_id
   WHERE e.id = _enrollment_id;

  IF v_student IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enrollment not found');
  END IF;

  IF NOT (public.has_role(_resolver, 'admin'::app_role)
          OR public.is_head_of_student(_resolver, v_student)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO v_existing FROM public.grades WHERE enrollment_id = _enrollment_id;
  IF v_existing IS NULL OR v_existing.is_incomplete IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Grade is not marked Incomplete');
  END IF;

  SELECT letter, grade_point, is_fail INTO v_scale
    FROM public.grade_scale WHERE letter = upper(_new_letter);
  IF v_scale IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown letter grade');
  END IF;
  IF v_scale.letter = 'I' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot resolve Incomplete to Incomplete');
  END IF;

  UPDATE public.grades
     SET letter_grade = v_scale.letter,
         grade_point  = v_scale.grade_point,
         is_fail      = v_scale.is_fail,
         is_incomplete = false,
         published_at = now(),
         published_by_user_id = _resolver
   WHERE enrollment_id = _enrollment_id;

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, changes)
  VALUES (_resolver, 'grade.resolve_incomplete', 'enrollment', _enrollment_id,
          jsonb_build_object('new_letter', v_scale.letter, 'note', _note,
                             'student_user_id', v_student, 'semester_id', v_semester));

  RETURN jsonb_build_object('ok', true,
                            'student_user_id', v_student,
                            'semester_id', v_semester);
END;
$$;
