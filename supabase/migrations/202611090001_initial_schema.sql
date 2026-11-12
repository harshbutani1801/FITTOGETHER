create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Member',
  timezone text not null default 'Asia/Kolkata',
  avatar_path text,
  pair_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text,
  plan_name text not null check (length(trim(plan_name)) between 1 and 120),
  version integer not null check (version > 0),
  status text not null default 'archived' check (status in ('active', 'archived')),
  source_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, version),
  unique (id, user_id)
);
create unique index workout_plans_one_active_per_user on public.workout_plans(user_id) where status = 'active';
create index workout_plans_user_created on public.workout_plans(user_id, created_at desc);

create table public.workout_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  day_name text not null,
  focus text not null default '',
  is_rest boolean not null default false,
  unique (plan_id, weekday),
  unique (id, plan_id)
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text,
  name text not null check (length(trim(name)) between 1 and 160),
  muscle_group text not null,
  exercise_type text not null default 'Strength',
  target_muscles text[] not null default '{}',
  description text not null default '',
  equipment text[] not null default '{}',
  breathing text not null default '',
  common_mistakes text[] not null default '{}',
  trainer_notes text not null default '',
  image_url text,
  video_url text,
  created_at timestamptz not null default now()
);
create index exercises_user_name on public.exercises(user_id, lower(name));

create table public.workout_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  workout_day_id uuid not null,
  exercise_id uuid references public.exercises(id) on delete set null,
  position integer not null check (position >= 0),
  sets integer not null check (sets >= 0),
  reps_min integer check (reps_min >= 0),
  reps_max integer check (reps_max >= 0),
  duration_seconds integer check (duration_seconds >= 0),
  rest_seconds integer not null default 0 check (rest_seconds >= 0),
  exercise_snapshot jsonb not null,
  unique (workout_day_id, position),
  foreign key (workout_day_id, plan_id) references public.workout_days(id, plan_id) on delete cascade
);
create index workout_plan_exercises_day on public.workout_plan_exercises(workout_day_id, position);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  plan_version integer,
  session_date date not null default current_date,
  weekday smallint not null check (weekday between 0 and 6),
  focus_snapshot text not null default '',
  status text not null default 'in_progress' check (status in ('in_progress', 'paused', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds integer check (duration_seconds >= 0),
  completion_percent numeric(5,2) not null default 0 check (completion_percent between 0 and 100),
  created_at timestamptz not null default now()
);
create unique index workout_sessions_one_open_per_day on public.workout_sessions(user_id, session_date, weekday) where status in ('in_progress', 'paused');
create index workout_sessions_user_history on public.workout_sessions(user_id, session_date desc);

create table public.exercise_completions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  plan_exercise_id uuid references public.workout_plan_exercises(id) on delete set null,
  exercise_name text not null,
  muscle_group text not null default '',
  exercise_snapshot jsonb not null default '{}'::jsonb,
  note text not null default '',
  completed boolean not null default false,
  completed_at timestamptz,
  unique (session_id, plan_exercise_id)
);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  exercise_completion_id uuid not null references public.exercise_completions(id) on delete cascade,
  set_number integer not null check (set_number > 0),
  actual_weight numeric(8,2) check (actual_weight >= 0),
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  actual_reps integer check (actual_reps >= 0),
  duration_seconds integer check (duration_seconds >= 0),
  completed_at timestamptz,
  unique (exercise_completion_id, set_number)
);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at date not null default current_date,
  metric text not null,
  custom_name text,
  value numeric(9,2) not null check (value >= 0),
  unit text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index body_measurements_user_date on public.body_measurements(user_id, measured_at desc);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  captured_at date not null default current_date,
  caption text not null default '',
  share_with_partner boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.workout_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.workout_sessions(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sharing_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share_weight boolean not null default false,
  share_measurements boolean not null default false,
  share_workout_history boolean not null default false,
  share_exercise_performance boolean not null default false,
  share_progress_photos boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Kolkata',
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  length_unit text not null default 'cm' check (length_unit in ('cm', 'in')),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger sharing_preferences_updated_at before update on public.sharing_preferences for each row execute function public.set_updated_at();
create trigger user_preferences_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();
create trigger workout_notes_updated_at before update on public.workout_notes for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'Member'), '@', 1)));
  insert into public.sharing_preferences(user_id) values (new.id);
  insert into public.user_preferences(user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id, display_name)
select id, coalesce(nullif(raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(email, 'Member'), '@', 1)) from auth.users
on conflict (id) do nothing;
insert into public.sharing_preferences(user_id) select id from auth.users on conflict (user_id) do nothing;
insert into public.user_preferences(user_id) select id from auth.users on conflict (user_id) do nothing;

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
        insert into public.exercises(user_id, external_id, name, muscle_group, exercise_type, target_muscles, description, equipment, breathing, common_mistakes, trainer_notes, image_url, video_url)
        values (v_user, v_external_id, coalesce(v_exercise ->> 'exerciseName','Exercise'), coalesce(v_exercise ->> 'muscleGroup',''), coalesce(v_exercise ->> 'exerciseType','Strength'), coalesce(array(select jsonb_array_elements_text(coalesce(v_exercise -> 'targetMuscles','[]'::jsonb))), '{}'), coalesce(v_exercise ->> 'description',''), coalesce(array(select jsonb_array_elements_text(coalesce(v_exercise -> 'equipment','[]'::jsonb))), '{}'), coalesce(v_exercise ->> 'breathing',''), coalesce(array(select jsonb_array_elements_text(coalesce(v_exercise -> 'commonMistakes','[]'::jsonb))), '{}'), coalesce(v_exercise ->> 'trainerNotes',''), v_exercise ->> 'imageUrl', v_exercise ->> 'videoUrl') returning id into v_exercise_id;
      end if;
      v_reps := v_exercise -> 'reps';
      insert into public.workout_plan_exercises(plan_id, workout_day_id, exercise_id, position, sets, reps_min, reps_max, duration_seconds, rest_seconds, exercise_snapshot)
      values (v_plan_id, v_day_id, v_exercise_id, v_pos, coalesce((v_exercise ->> 'sets')::integer, 0), nullif(v_reps ->> 'min','')::integer, nullif(v_reps ->> 'max','')::integer, nullif(v_exercise ->> 'durationSeconds','null')::integer, coalesce(nullif(v_exercise ->> 'restSeconds','')::integer,0), v_exercise);
      v_pos := v_pos + 1;
    end loop;
  end loop;
  return v_plan_id;
end $$;
revoke all on function public.import_workout_plan(jsonb) from public;
grant execute on function public.import_workout_plan(jsonb) to authenticated;

alter table public.profiles enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_days enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_plan_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_completions enable row level security;
alter table public.set_logs enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.workout_notes enable row level security;
alter table public.sharing_preferences enable row level security;
alter table public.user_preferences enable row level security;

create policy "profile self or paired profile read" on public.profiles for select to authenticated using (id = (select auth.uid()) or (pair_id is not null and pair_id = (select p.pair_id from public.profiles p where p.id = (select auth.uid()))));
create policy "profile self update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant update (display_name, timezone, avatar_path) on public.profiles to authenticated;

create policy "plan owner all" on public.workout_plans for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "day owner read" on public.workout_days for select to authenticated using (exists(select 1 from public.workout_plans p where p.id = plan_id and p.user_id = (select auth.uid())));
create policy "exercise owner all" on public.exercises for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "plan exercise owner read" on public.workout_plan_exercises for select to authenticated using (exists(select 1 from public.workout_plans p where p.id = plan_id and p.user_id = (select auth.uid())));

create policy "session owner or shared history read" on public.workout_sessions for select to authenticated using (user_id = (select auth.uid()) or exists(select 1 from public.profiles me join public.profiles owner on owner.id = user_id join public.sharing_preferences sp on sp.user_id = owner.id where me.id = (select auth.uid()) and me.pair_id is not null and owner.pair_id = me.pair_id and sp.share_workout_history));
create policy "session owner write" on public.workout_sessions for insert to authenticated with check (user_id = (select auth.uid()));
create policy "session owner update" on public.workout_sessions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "completion owner or shared performance read" on public.exercise_completions for select to authenticated using (exists(select 1 from public.workout_sessions s where s.id = session_id and (s.user_id = (select auth.uid()) or exists(select 1 from public.profiles me join public.profiles owner on owner.id = s.user_id join public.sharing_preferences sp on sp.user_id = owner.id where me.id = (select auth.uid()) and me.pair_id is not null and owner.pair_id = me.pair_id and sp.share_exercise_performance))));
create policy "completion owner write" on public.exercise_completions for all to authenticated using (exists(select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid()))) with check (exists(select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy "set owner or shared performance read" on public.set_logs for select to authenticated using (exists(select 1 from public.exercise_completions ec join public.workout_sessions s on s.id = ec.session_id where ec.id = exercise_completion_id and (s.user_id = (select auth.uid()) or exists(select 1 from public.profiles me join public.profiles owner on owner.id = s.user_id join public.sharing_preferences sp on sp.user_id = owner.id where me.id = (select auth.uid()) and me.pair_id is not null and owner.pair_id = me.pair_id and sp.share_exercise_performance))));
create policy "set owner write" on public.set_logs for all to authenticated using (exists(select 1 from public.exercise_completions ec join public.workout_sessions s on s.id = ec.session_id where ec.id = exercise_completion_id and s.user_id = (select auth.uid()))) with check (exists(select 1 from public.exercise_completions ec join public.workout_sessions s on s.id = ec.session_id where ec.id = exercise_completion_id and s.user_id = (select auth.uid())));
create policy "measurement owner or shared read" on public.body_measurements for select to authenticated using (user_id = (select auth.uid()) or exists(select 1 from public.profiles me join public.profiles owner on owner.id = user_id join public.sharing_preferences sp on sp.user_id = owner.id where me.id = (select auth.uid()) and me.pair_id is not null and owner.pair_id = me.pair_id and ((metric = 'weight' and sp.share_weight) or (metric <> 'weight' and sp.share_measurements))));
create policy "measurement owner write" on public.body_measurements for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "photo owner or shared read" on public.progress_photos for select to authenticated using (user_id = (select auth.uid()) or (share_with_partner and exists(select 1 from public.profiles me join public.profiles owner on owner.id = user_id join public.sharing_preferences sp on sp.user_id = owner.id where me.id = (select auth.uid()) and me.pair_id is not null and owner.pair_id = me.pair_id and sp.share_progress_photos)));
create policy "photo owner write" on public.progress_photos for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notes owner all" on public.workout_notes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "sharing owner all" on public.sharing_preferences for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "preferences owner all" on public.user_preferences for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;
create policy "photo storage owner read" on storage.objects for select to authenticated using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photo storage owner upload" on storage.objects for insert to authenticated with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photo storage owner delete" on storage.objects for delete to authenticated using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
