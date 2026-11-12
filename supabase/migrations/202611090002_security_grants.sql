create schema if not exists private;

create or replace function private.current_pair_id() returns uuid language sql stable security definer set search_path = '' as $$
  select pair_id from public.profiles where id = auth.uid()
$$;
create or replace function private.can_view_partner(p_owner uuid, p_kind text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles viewer
    join public.profiles owner on owner.pair_id = viewer.pair_id and owner.id = p_owner
    join public.sharing_preferences sp on sp.user_id = owner.id
    where viewer.id = auth.uid() and viewer.pair_id is not null
      and case p_kind
        when 'weight' then sp.share_weight
        when 'measurements' then sp.share_measurements
        when 'workout_history' then sp.share_workout_history
        when 'exercise_performance' then sp.share_exercise_performance
        when 'progress_photos' then sp.share_progress_photos
        else false
      end
  )
$$;
revoke all on function private.current_pair_id() from public;
revoke all on function private.can_view_partner(uuid, text) from public;
grant usage on schema private to authenticated;
grant execute on function private.current_pair_id() to authenticated;
grant execute on function private.can_view_partner(uuid, text) to authenticated;

drop policy "profile self or paired profile read" on public.profiles;
create policy "profile self or paired profile read" on public.profiles for select to authenticated using (id = (select auth.uid()) or (pair_id is not null and pair_id = (select private.current_pair_id())));

drop policy "session owner or shared history read" on public.workout_sessions;
create policy "session owner or shared history read" on public.workout_sessions for select to authenticated using (user_id = (select auth.uid()) or private.can_view_partner(user_id, 'workout_history'));
drop policy "completion owner or shared performance read" on public.exercise_completions;
create policy "completion owner or shared performance read" on public.exercise_completions for select to authenticated using (exists(select 1 from public.workout_sessions s where s.id = session_id and (s.user_id = (select auth.uid()) or private.can_view_partner(s.user_id, 'exercise_performance'))));
drop policy "set owner or shared performance read" on public.set_logs;
create policy "set owner or shared performance read" on public.set_logs for select to authenticated using (exists(select 1 from public.exercise_completions ec join public.workout_sessions s on s.id = ec.session_id where ec.id = exercise_completion_id and (s.user_id = (select auth.uid()) or private.can_view_partner(s.user_id, 'exercise_performance'))));
drop policy "measurement owner or shared read" on public.body_measurements;
create policy "measurement owner or shared read" on public.body_measurements for select to authenticated using (user_id = (select auth.uid()) or private.can_view_partner(user_id, case when metric = 'weight' then 'weight' else 'measurements' end));
drop policy "photo owner or shared read" on public.progress_photos;
create policy "photo owner or shared read" on public.progress_photos for select to authenticated using (user_id = (select auth.uid()) or (share_with_partner and private.can_view_partner(user_id, 'progress_photos')));
create policy "partner may read approved photo objects" on storage.objects for select to authenticated using (
  bucket_id = 'progress-photos' and exists (
    select 1 from public.progress_photos photo
    where photo.storage_path = name and photo.share_with_partner and private.can_view_partner(photo.user_id, 'progress_photos')
  )
);

-- Public clients get no access. Authenticated users receive only the SQL privileges
-- needed by their owner-scoped RLS policies and the plan-import RPC.
grant usage on schema public to authenticated;
grant select, insert, delete on public.profiles to authenticated;
grant update (display_name, timezone, avatar_path) on public.profiles to authenticated;
revoke all on public.workout_plans, public.workout_sessions, public.set_logs, public.exercises, public.workout_days, public.workout_plan_exercises from authenticated;
grant select on public.workout_plans, public.workout_sessions, public.set_logs, public.exercises, public.workout_days, public.workout_plan_exercises to authenticated;
grant select on public.exercise_completions to authenticated;
grant update (completed, note, completed_at) on public.exercise_completions to authenticated;
grant select, insert, update, delete on public.body_measurements, public.progress_photos, public.workout_notes, public.sharing_preferences, public.user_preferences to authenticated;
revoke select on public.body_measurements, public.exercise_completions from authenticated;
grant select (id, user_id, measured_at, metric, custom_name, value, unit, created_at) on public.body_measurements to authenticated;
grant select (id, session_id, plan_exercise_id, exercise_name, muscle_group, exercise_snapshot, completed, completed_at) on public.exercise_completions to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;


create or replace function public.validate_user_timezone() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Timezone must be a valid IANA timezone.' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger profiles_validate_timezone before insert or update of timezone on public.profiles for each row execute function public.validate_user_timezone();
create trigger user_preferences_validate_timezone before insert or update of timezone on public.user_preferences for each row execute function public.validate_user_timezone();