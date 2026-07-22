
UPDATE public.grades g SET letter_grade='B'
  FROM public.enrollments e
  JOIN public.course_offerings co ON co.id=e.course_offering_id
  JOIN public.courses c ON c.id=co.course_id
 WHERE g.enrollment_id=e.id
   AND e.student_user_id='55555555-5555-5555-5555-555555555501'
   AND c.code IN ('0222-1101','0613-1205','0541-1203');

UPDATE public.grades g SET letter_grade='C'
  FROM public.enrollments e
  JOIN public.course_offerings co ON co.id=e.course_offering_id
  JOIN public.courses c ON c.id=co.course_id
 WHERE g.enrollment_id=e.id
   AND e.student_user_id='55555555-5555-5555-5555-555555555501'
   AND c.code IN ('0533-1101','0533-1201');

UPDATE public.semester_results SET sgpa=3.40
 WHERE student_user_id='55555555-5555-5555-5555-555555555501'
   AND semester_id='33333333-3333-3333-3333-333333333301';

UPDATE public.semester_results SET sgpa=3.32
 WHERE student_user_id='55555555-5555-5555-5555-555555555501'
   AND semester_id='33333333-3333-3333-3333-333333333302';
