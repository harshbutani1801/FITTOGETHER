-- Supabase may grant EXECUTE to anon through project-wide default privileges.
-- Trigger functions need no client EXECUTE grant; app RPCs are authenticated-only.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.validate_user_timezone() from public, anon, authenticated;

revoke all on function public.import_workout_plan(jsonb) from public, anon;
grant execute on function public.import_workout_plan(jsonb) to authenticated;

revoke all on function public.start_workout(smallint) from public, anon;
revoke all on function public.record_workout_set(uuid,uuid,integer,numeric,text,integer,integer,boolean) from public, anon;
revoke all on function public.refresh_workout_progress(uuid) from public, anon;
revoke all on function public.set_workout_status(uuid,text) from public, anon;
grant execute on function public.start_workout(smallint) to authenticated;
grant execute on function public.record_workout_set(uuid,uuid,integer,numeric,text,integer,integer,boolean) to authenticated;
grant execute on function public.refresh_workout_progress(uuid) to authenticated;
grant execute on function public.set_workout_status(uuid,text) to authenticated;

revoke all on function private.current_pair_id() from public, anon;
revoke all on function private.can_view_partner(uuid,text) from public, anon;
grant execute on function private.current_pair_id() to authenticated;
grant execute on function private.can_view_partner(uuid,text) to authenticated;
