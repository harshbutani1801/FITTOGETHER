create or replace function public.start_workout(p_weekday smallint) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_plan_id uuid; v_plan_version integer; v_focus text; v_session_id uuid; v_status text; v_is_rest boolean; v_timezone text; v_session_date date;
begin
  if v_user is null then raise exception 'You must be signed in.' using errcode = '42501'; end if;
  if p_weekday not between 0 and 6 then raise exception 'Choose a weekday from the plan.' using errcode = '22023'; end if;
  select p.id, p.version, d.focus, d.is_rest into v_plan_id, v_plan_version, v_focus, v_is_rest
    from public.workout_plans p join public.workout_days d on d.plan_id = p.id
    where p.user_id = v_user and p.status = 'active' and d.weekday = p_weekday;
  if v_plan_id is null then raise exception 'There is no active workout for that weekday.' using errcode = 'P0002'; end if;
  if v_is_rest then raise exception 'That weekday is a rest day.' using errcode = '22023'; end if;
  select coalesce(up.timezone, pr.timezone, 'Asia/Kolkata') into v_timezone from public.profiles pr left join public.user_preferences up on up.user_id = pr.id where pr.id = v_user;
  v_session_date := (now() at time zone v_timezone)::date;
  insert into public.workout_sessions(user_id, plan_id, plan_version, session_date, weekday, focus_snapshot)
  values (v_user, v_plan_id, v_plan_version, v_session_date, p_weekday, coalesce(v_focus, ''))
  on conflict (user_id, session_date, weekday) where status in ('in_progress', 'paused') do nothing returning id into v_session_id;
  if v_session_id is null then
    select id, status into v_session_id, v_status from public.workout_sessions where user_id = v_user and session_date = v_session_date and weekday = p_weekday and status in ('in_progress', 'paused');
  else
    insert into public.exercise_completions(session_id, plan_exercise_id, exercise_name, muscle_group, exercise_snapshot)
    select v_session_id, wpe.id, coalesce(wpe.exercise_snapshot ->> 'exerciseName','Exercise'), coalesce(wpe.exercise_snapshot ->> 'muscleGroup',''), wpe.exercise_snapshot
    from public.workout_plan_exercises wpe join public.workout_days d on d.id = wpe.workout_day_id
    where d.plan_id = v_plan_id and d.weekday = p_weekday order by wpe.position;
  end if;
  return v_session_id;
end $$;

create or replace function public.record_workout_set(
  p_session_id uuid, p_completion_id uuid, p_set_number integer, p_weight numeric, p_weight_unit text, p_reps integer, p_duration_seconds integer, p_completed boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_prescribed_sets integer; v_session uuid;
begin
  if v_user is null then raise exception 'You must be signed in.' using errcode = '42501'; end if;
  select s.id, coalesce((ec.exercise_snapshot ->> 'sets')::integer, 0) into v_session, v_prescribed_sets
  from public.workout_sessions s join public.exercise_completions ec on ec.session_id = s.id
  where s.id = p_session_id and ec.id = p_completion_id and s.user_id = v_user and s.status in ('in_progress','paused');
  if v_session is null then raise exception 'Workout session not found or no longer editable.' using errcode = '42501'; end if;
  if p_set_number < 1 or p_set_number > greatest(v_prescribed_sets, 1) then raise exception 'Set number is outside the prescription.' using errcode = '22023'; end if;
  if p_weight_unit not in ('kg','lb') then raise exception 'Weight unit must be kg or lb.' using errcode = '22023'; end if;
  insert into public.set_logs(exercise_completion_id, set_number, actual_weight, weight_unit, actual_reps, duration_seconds, completed_at)
  values (p_completion_id, p_set_number, p_weight, p_weight_unit, p_reps, p_duration_seconds, case when p_completed then now() else null end)
  on conflict (exercise_completion_id, set_number) do update set actual_weight = excluded.actual_weight, weight_unit = excluded.weight_unit, actual_reps = excluded.actual_reps, duration_seconds = excluded.duration_seconds, completed_at = excluded.completed_at;
  update public.exercise_completions ec set completed = (select count(*) from public.set_logs sl where sl.exercise_completion_id = ec.id and sl.completed_at is not null) >= greatest(v_prescribed_sets, 1), completed_at = case when (select count(*) from public.set_logs sl where sl.exercise_completion_id = ec.id and sl.completed_at is not null) >= greatest(v_prescribed_sets, 1) then now() else null end where ec.id = p_completion_id;
  update public.workout_sessions s set completion_percent = coalesce((select round(100.0 * count(*) filter (where completed) / nullif(count(*),0), 2) from public.exercise_completions ec where ec.session_id = s.id),0) where s.id = p_session_id;
end $$;

create or replace function public.refresh_workout_progress(p_session_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_total integer; v_done integer;
begin
  if v_user is null then raise exception 'You must be signed in.' using errcode = '42501'; end if;
  select count(*), count(*) filter (where completed) into v_total, v_done from public.exercise_completions where session_id = p_session_id;
  update public.workout_sessions set completion_percent = case when v_total = 0 then 0 else round(100.0 * v_done / v_total, 2) end where id = p_session_id and user_id = v_user and status in ('in_progress','paused');
  if not found then raise exception 'Workout session not found or no longer editable.' using errcode = '42501'; end if;
end $$;
create or replace function public.set_workout_status(p_session_id uuid, p_status text) returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_started timestamptz; v_current text;
begin
  if v_user is null then raise exception 'You must be signed in.' using errcode = '42501'; end if;
  if p_status not in ('in_progress','paused','completed','abandoned') then raise exception 'Invalid workout status.' using errcode = '22023'; end if;
  select started_at, status into v_started, v_current from public.workout_sessions where id = p_session_id and user_id = v_user for update;
  if v_started is null then raise exception 'Workout session not found.' using errcode = 'P0002'; end if;
  if v_current in ('completed','abandoned') and p_status <> v_current then raise exception 'Finished workouts cannot be reopened.' using errcode = '22023'; end if;
  update public.workout_sessions set status = p_status, finished_at = case when p_status in ('completed','abandoned') then now() else null end,
    duration_seconds = case when p_status = 'completed' then greatest(0, extract(epoch from (now() - v_started))::integer) else duration_seconds end,
    completion_percent = case when p_status = 'completed' and not exists(select 1 from public.exercise_completions ec where ec.session_id = p_session_id) then 100 else completion_percent end
  where id = p_session_id and user_id = v_user;
end $$;

revoke all on function public.start_workout(smallint) from public;
revoke all on function public.record_workout_set(uuid,uuid,integer,numeric,text,integer,integer,boolean) from public;
revoke all on function public.set_workout_status(uuid,text) from public;
revoke all on function public.refresh_workout_progress(uuid) from public;
grant execute on function public.start_workout(smallint) to authenticated;
grant execute on function public.record_workout_set(uuid,uuid,integer,numeric,text,integer,integer,boolean) to authenticated;
grant execute on function public.set_workout_status(uuid,text) to authenticated;
grant execute on function public.refresh_workout_progress(uuid) to authenticated;
