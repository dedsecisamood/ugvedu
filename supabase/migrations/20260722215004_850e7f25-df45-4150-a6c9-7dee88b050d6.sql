
DELETE FROM public.enrollments e
 USING public.course_offerings co, public.courses c
 WHERE e.course_offering_id = co.id
   AND co.course_id = c.id
   AND e.student_user_id = '55555555-5555-5555-5555-555555555501'
   AND co.semester_id = '33333333-3333-3333-3333-333333333301'
   AND c.code IN ('0531-1102','0533-1102','0611-1102','0613-1104');
