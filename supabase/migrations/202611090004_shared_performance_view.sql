create or replace view public.shared_exercise_performance with (security_invoker = false) as
select s.user_id, s.id as session_id, ec.id as completion_id, ec.exercise_name, ec.muscle_group,
       ec.completed, sl.set_number, sl.actual_weight, sl.weight_unit, sl.actual_reps, sl.duration_seconds, sl.completed_at
from public.workout_sessions s
join public.exercise_completions ec on ec.session_id = s.id
left join public.set_logs sl on sl.exercise_completion_id = ec.id
where s.status = 'completed'
  and (s.user_id = auth.uid() or private.can_view_partner(s.user_id, 'exercise_performance'));
revoke all on public.shared_exercise_performance from public, anon;
grant select on public.shared_exercise_performance to authenticated;


create or replace view public.my_body_measurements with (security_invoker = false) as
select id, user_id, measured_at, metric, custom_name, value, unit, note, created_at
from public.body_measurements where user_id = auth.uid();
create or replace view public.my_exercise_completion_notes with (security_invoker = false) as
select ec.id, ec.session_id, ec.note
from public.exercise_completions ec
join public.workout_sessions s on s.id = ec.session_id
where s.user_id = auth.uid();
revoke all on public.my_body_measurements, public.my_exercise_completion_notes from public, anon;
grant select on public.my_body_measurements, public.my_exercise_completion_notes to authenticated;