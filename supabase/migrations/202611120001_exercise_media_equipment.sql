alter table public.exercises
  add column equipment_details jsonb not null default '{}'::jsonb,
  add column media jsonb not null default '{"type":"none"}'::jsonb;

create or replace function public.import_workout_plan(p_plan jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_plan_id uuid; v_name text; v_version integer; v_day jsonb; v_exercise jsonb;
  v_day_id uuid; v_exercise_id uuid; v_external_id text; v_weekday smallint; v_seen boolean[] := array[false,false,false,false,false,false,false]; v_pos integer; v_reps jsonb;
begin
  if v_user is null then raise exception 'You must be signed in.' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  if jsonb_typeof(p_plan) <> 'object' or jsonb_typeof(p_plan -> 'workoutDays') <> 'array' then raise exception 'Plan must include a workoutDays array.' using errcode = '22023'; end if;
  v_name := trim(coalesce(p_plan ->> 'planName', ''));
  if v_name = '' or length(v_name) > 120 then raise exception 'Plan name must be between 1 and 120 characters.' using errcode = '22023'; end if;
  if jsonb_array_length(p_plan -> 'workoutDays') <> 7 then raise exception 'A plan must contain all seven weekdays.' using errcode = '22023'; end if;
  for v_day in select value from jsonb_array_elements(p_plan -> 'workoutDays') loop
    v_weekday := case lower(v_day ->> 'day') when 'sunday' then 0 when 'monday' then 1 when 'tuesday' then 2 when 'wednesday' then 3 when 'thursday' then 4 when 'friday' then 5 when 'saturday' then 6 else null end;
    if v_weekday is null or v_seen[v_weekday + 1] then raise exception 'Each weekday must appear exactly once.' using errcode = '22023'; end if;
    v_seen[v_weekday + 1] := true;
  end loop;
  select coalesce(max(version), 0) + 1 into v_version from public.workout_plans where user_id = v_user;
  update public.workout_plans set status = 'archived' where user_id = v_user and status = 'active';
  insert into public.workout_plans(user_id, plan_key, plan_name, version, status, source_json)
  values (v_user, p_plan ->> 'planId', v_name, v_version, 'active', p_plan) returning id into v_plan_id;
  for v_day in select value from jsonb_array_elements(p_plan -> 'workoutDays') loop
    v_weekday := case lower(v_day ->> 'day') when 'sunday' then 0 when 'monday' then 1 when 'tuesday' then 2 when 'wednesday' then 3 when 'thursday' then 4 when 'friday' then 5 when 'saturday' then 6 end;
    insert into public.workout_days(plan_id, weekday, day_name, focus, is_rest)
    values (v_plan_id, v_weekday, initcap(lower(v_day ->> 'day')), coalesce(v_day ->> 'focus', ''), coalesce(jsonb_array_length(v_day -> 'exercises') = 0, true)) returning id into v_day_id;
    v_pos := 0;
    for v_exercise in select value from jsonb_array_elements(coalesce(v_day -> 'exercises', '[]'::jsonb)) loop
      v_external_id := nullif(v_exercise ->> 'exerciseId', '');
      select id into v_exercise_id from public.exercises where user_id = v_user and external_id is not distinct from v_external_id and name = coalesce(v_exercise ->> 'exerciseName', '');
      if v_exercise_id is null then
        insert into public.exercises(user_id, external_id, name, muscle_group, exercise_type, target_muscles, description, equipment, breathing, common_mistakes, trainer_notes, image_url, video_url, equipment_details, media)
        values (v_user, v_external_id, coalesce(v_exercise ->> 'exerciseName','Exercise'), coalesce(v_exercise ->> 'muscleGroup',''), coalesce(v_exercise ->> 'exerciseType','Strength'), coalesce(array(select jsonb_array_elements_text(coalesce(v_exercise -> 'targetMuscles','[]'::jsonb))), '{}'), coalesce(v_exercise ->> 'description',''), coalesce(array(select jsonb_array_elements_text(coalesce(v_exercise -> 'equipment','[]'::jsonb))), '{}'), coalesce(v_exercise ->> 'breathing',''), coalesce(array(select jsonb_array_elements_text(coalesce(v_exercise -> 'commonMistakes','[]'::jsonb))), '{}'), coalesce(v_exercise ->> 'trainerNotes',''), v_exercise ->> 'imageUrl', v_exercise ->> 'videoUrl', coalesce(v_exercise -> 'equipmentDetails', '{}'::jsonb), coalesce(v_exercise -> 'media', '{"type":"none"}'::jsonb)) returning id into v_exercise_id;
      else
        update public.exercises set equipment_details = coalesce(v_exercise -> 'equipmentDetails', '{}'::jsonb), media = coalesce(v_exercise -> 'media', '{"type":"none"}'::jsonb), image_url = v_exercise ->> 'imageUrl', video_url = v_exercise ->> 'videoUrl' where id = v_exercise_id;
      end if;
      v_reps := v_exercise -> 'reps';
      insert into public.workout_plan_exercises(plan_id, workout_day_id, exercise_id, position, sets, reps_min, reps_max, duration_seconds, rest_seconds, exercise_snapshot)
      values (v_plan_id, v_day_id, v_exercise_id, v_pos, coalesce((v_exercise ->> 'sets')::integer, 0), nullif(v_reps ->> 'min','')::integer, nullif(v_reps ->> 'max','')::integer, nullif(v_exercise ->> 'durationSeconds','null')::integer, coalesce(nullif(v_exercise ->> 'restSeconds','')::integer,0), v_exercise);
      v_pos := v_pos + 1;
    end loop;
  end loop;
  return v_plan_id;
end $$;
revoke all on function public.import_workout_plan(jsonb) from public, anon;
grant execute on function public.import_workout_plan(jsonb) to authenticated;
