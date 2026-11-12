import { createServerSupabaseClient } from "@/lib/supabase/server";
import { WorkoutWeek } from "@/components/workout/week";

const weekdayCode: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
function todayInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default async function WorkoutPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
  const timezone = profile?.timezone || "Asia/Kolkata";
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: timezone }).format(new Date());
  const todayCode = weekdayCode[today] ?? 1;
  const sessionDate = todayInTimezone(timezone);
  const { data: planData } = await supabase.from("workout_plans").select("id,plan_name,workout_days(id,weekday,day_name,focus,is_rest,workout_plan_exercises(id,position,sets,reps_min,reps_max,duration_seconds,rest_seconds,exercise_snapshot))").eq("status", "active").maybeSingle();
  if (!planData) return <div className="page-content"><section className="surface-card empty-state workout-empty"><strong>No active plan yet</strong><span>Import your weekly JSON workout plan to get started.</span><a className="primary-action inline-action" href="/dashboard/plans">Manage workout plans</a></section></div>;
  const { data: sessionData } = await supabase.from("workout_sessions").select("id,weekday,status,completion_percent,started_at,exercise_completions(id,session_id,plan_exercise_id,exercise_name,muscle_group,exercise_snapshot,completed,set_logs(id,set_number,actual_weight,weight_unit,actual_reps,duration_seconds,completed_at))").eq("session_date", sessionDate).in("status", ["in_progress", "paused", "completed"]);
  const rawSessions = sessionData ?? [];
  const sessionIds = rawSessions.map((item) => item.id);
  const { data: noteRows } = sessionIds.length ? await supabase.from("my_exercise_completion_notes").select("id,session_id,note").in("session_id", sessionIds) : { data: [] };
  const notes = new Map((noteRows ?? []).map((item) => [item.id, item.note]));
  const hydratedSessions = rawSessions.map((session) => ({ ...session, exercise_completions: session.exercise_completions.map((exercise) => ({ ...exercise, note: notes.get(exercise.id) ?? "" })) }));
  const sessions = hydratedSessions as unknown as Array<{ id: string; weekday: number; status: string; completion_percent: number; started_at: string; exercise_completions: Array<{ id: string; session_id: string; completed: boolean; note: string; exercise_snapshot: never; plan_exercise_id: string | null; exercise_name: string; muscle_group: string; set_logs: Array<{ set_number:number; actual_weight:number|null; weight_unit:string; actual_reps:number|null; duration_seconds:number|null; completed_at:string|null }> }> }>;
  const stateKey = sessions.map((item) => `${item.id}:${item.status}:${item.completion_percent}:${item.exercise_completions.map((entry) => `${entry.id}-${entry.completed}-${entry.note}-${entry.set_logs.map((log) => `${log.set_number}-${log.actual_weight}-${log.weight_unit}-${log.actual_reps}-${log.duration_seconds}-${log.completed_at}`).join(".")}`).join(",")}`).join("|");
  return <WorkoutWeek key={stateKey} days={planData.workout_days as never} todayCode={todayCode} timezone={timezone} existingSessions={sessions as never} activePlanName={planData.plan_name} />;
}
