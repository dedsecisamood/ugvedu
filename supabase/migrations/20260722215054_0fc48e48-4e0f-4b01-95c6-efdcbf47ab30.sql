
WITH new_courses AS (
  INSERT INTO public.courses (code, title, credits, department_id, course_type) VALUES
    ('0713-1103','Basic Electrical Engineering', 3, '11111111-1111-1111-1111-111111111101', 'THEORY'),
    ('0716-1101','Engineering Drawing', 2, '11111111-1111-1111-1111-111111111101', 'THEORY')
  RETURNING id, code
),
new_offerings AS (
  INSERT INTO public.course_offerings (course_id, semester_id, capacity, section)
  SELECT id, '33333333-3333-3333-3333-333333333301', 60, 'A' FROM new_courses
  RETURNING id, course_id
),
new_enrollments AS (
  INSERT INTO public.enrollments (student_user_id, course_offering_id, status)
  SELECT '55555555-5555-5555-5555-555555555501', o.id, 'COMPLETED' FROM new_offerings o
  RETURNING id, course_offering_id
)
INSERT INTO public.grades (enrollment_id, letter_grade, is_fail, is_incomplete, published_at)
SELECT ne.id,
       CASE WHEN c.code='0713-1103' THEN 'B' ELSE 'A-' END,
       false, false, now()
FROM new_enrollments ne
JOIN new_offerings o ON o.id=ne.course_offering_id
JOIN new_courses c ON c.id=o.course_id;
