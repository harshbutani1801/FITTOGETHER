import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, Dumbbell, Scale, Sparkles, Users } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PlanSummary } from "@/components/plans/management";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const weekdayCode: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
function localDate(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (kind: string) => parts.find((item) => item.type === kind)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: planData }, { data: recentWorkouts }, { data: recentMeasurements }, { count: workoutCount }] = await Promise.all([
    supabase.from("profiles").select("display_name,timezone,pair_id").eq("id", user.id).maybeSingle(),
    supabase.from("workout_plans").select("id,plan_name,version,status,created_at,source_json,workout_days(id,weekday,day_name,focus,is_rest,workout_plan_exercises(id,position,sets,reps_min,reps_max,duration_seconds,rest_seconds,exercise_snapshot))").eq("status", "active").maybeSingle(),
    supabase.from("workout_sessions").select("id,session_date,weekday,focus_snapshot,duration_seconds,completion_percent,status,plan_version").eq("user_id", user.id).eq("status", "completed").order("session_date", { ascending: false }).limit(4),
    supabase.from("body_measurements").select("id,measured_at,metric,custom_name,value,unit").eq("user_id", user.id).order("measured_at", { ascending: false }).limit(20),
    supabase.from("workout_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
  ]);
  const plan = planData as unknown as PlanSummary | null;
  const timezone = profile?.timezone || "Asia/Kolkata";
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: timezone }).format(new Date());
  const todayCode = weekdayCode[today] ?? 1;
  const todayDate = localDate(timezone);
  const dayPlans = plan?.workout_days ?? [];
  const todayPlan = dayPlans.find((day) => day.weekday === todayCode);
  const exercises = todayPlan?.workout_plan_exercises ?? [];
  const name = profile?.display_name || user.email?.split("@")[0] || "there";
  const [{ data: todaySession }, { data: partner }] = await Promise.all([
    supabase.from("workout_sessions").select("id,status,completion_percent").eq("user_id", user.id).eq("session_date", todayDate).eq("weekday", todayCode).maybeSingle(),
    profile?.pair_id ? supabase.from("profiles").select("id,display_name").eq("pair_id", profile.pair_id).neq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const { data: partnerWeight } = partner ? await supabase.from("body_measurements").select("value,unit,measured_at").eq("user_id", partner.id).eq("metric", "weight").order("measured_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const latestWeight = recentMeasurements?.find((entry) => entry.metric === "weight");
  const recentByMetric = [...new Map((recentMeasurements ?? []).map((entry) => [entry.metric, entry])).values()].slice(0, 4);
  const weekly = weekdays.map((day) => {
    const code = weekdayCode[day];
    const entry = dayPlans.find((item) => item.weekday === code);
    return { day: day.slice(0, 3), focus: entry?.focus || "Rest", count: entry?.workout_plan_exercises.length ?? 0, today: code === todayCode, rest: entry?.is_rest ?? true };
  });
  const isRest = todayPlan?.is_rest || exercises.length === 0;
  const sessionLabel = todaySession?.status === "completed" ? "Workout completed" : todaySession?.status === "paused" ? "Workout paused" : todaySession ? "Workout in progress" : "Start today's workout";

  return <div className="page-content">
    <div className="page-heading"><div><p className="eyebrow">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: timezone }).format(new Date()).toUpperCase()}</p><h1>Good day, {name}</h1><p className="intro">A little progress today adds up. Let&apos;s see what&apos;s on your plan.</p></div><Link className="secondary-action" href="/dashboard/workout"><Dumbbell size={16} /> Open workout <ArrowRight size={15} /></Link></div>
    {!plan ? <section className="empty-plan-card"><span className="empty-plan-icon"><Sparkles size={22} /></span><div><h2>Your first week starts with a plan</h2><p>Import the JSON plan from your trainer. We&apos;ll organize it across the week and keep every version safe.</p><Link className="primary-action inline-action" href="/dashboard/plans"><span>Import a workout plan</span><ArrowRight size={16} /></Link></div></section> : <>
      <section className="overview-stats"><article className="overview-stat"><span className="overview-stat-icon"><Dumbbell size={18} /></span><span className="overview-stat-label">ACTIVE PLAN</span><strong>{plan.plan_name}</strong><small>Version {plan.version}</small></article><article className="overview-stat"><span className="overview-stat-icon"><CalendarDays size={18} /></span><span className="overview-stat-label">TRAINING DAYS</span><strong>{dayPlans.filter((day) => !day.is_rest).length} <small>of 7 this week</small></strong><small>Repeats weekly</small></article><article className="overview-stat"><span className="overview-stat-icon"><Clock3 size={18} /></span><span className="overview-stat-label">COMPLETED WORKOUTS</span><strong>{workoutCount ?? 0}</strong><small>{recentWorkouts?.[0] ? `Last: ${new Date(`${recentWorkouts[0].session_date}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" })}` : "Your history starts with your first session"}</small></article><article className="overview-stat"><span className="overview-stat-icon"><Scale size={18} /></span><span className="overview-stat-label">LATEST WEIGHT</span><strong>{latestWeight ? `${latestWeight.value} ${latestWeight.unit}` : "-"}</strong><small>{latestWeight ? `Recorded ${new Date(`${latestWeight.measured_at}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" })}` : "Add a measurement in Progress"}</small></article></section>
      <section className="dashboard-grid"><article className="surface-card today-card"><div className="section-title-row"><div><span className="eyebrow">TODAY&apos;S SESSION</span><h2>{today} - {todayPlan?.focus || "Rest and recover"}</h2></div><span className="today-mark">TODAY</span></div>{isRest ? <div className="rest-state"><span className="rest-emoji"><Sparkles size={17}/></span><div><strong>Today is for recovery</strong><p>Rest is part of a good training plan. Move gently and come back refreshed.</p></div></div> : <><p className="session-summary">{todaySession ? `${todaySession.completion_percent}% complete - ${sessionLabel.toLowerCase()}` : `${exercises.length} exercises scheduled in your active plan.`}</p><div className="exercise-list">{exercises.slice(0, 4).map((exercise) => { const item = exercise.exercise_snapshot; return <div className="exercise-line" key={exercise.id}><span className="exercise-number">{String(exercise.position + 1).padStart(2, "0")}</span><span><strong>{String(item.exerciseName ?? "Exercise")}</strong><small>{String(item.muscleGroup ?? "")}</small></span><span className="prescription">{exercise.sets} x {exercise.reps_min ?? "-"}</span></div>; })}</div>{exercises.length > 4 && <p className="more-exercises">+ {exercises.length - 4} more exercises</p>}<Link className="primary-action inline-action" href="/dashboard/workout">{sessionLabel} <ArrowRight size={16} /></Link></>}</article>
      <article className="surface-card week-card"><div className="section-title-row"><div><span className="eyebrow">YOUR WEEK</span><h2>Monday to Sunday</h2></div><Link href="/dashboard/workout" className="subtle-link">View plan <ArrowRight size={14} /></Link></div><div className="week-overview">{weekly.map((day) => <div className={`week-day ${day.today ? "today" : ""} ${day.rest ? "rest" : ""}`} key={day.day}><span className="week-day-name">{day.day}</span><span className="week-day-dot">{day.today ? "*" : day.rest ? "-" : day.count}</span><span className="week-focus">{day.focus}</span></div>)}</div></article></section>
    </>}
    <section className="dashboard-lower"><article className="surface-card lower-card"><div className="section-title-row"><div><span className="eyebrow">RECENT SESSIONS</span><h2>Workout history</h2></div><Link href="/dashboard/history" className="subtle-link">See all <ArrowRight size={14}/></Link></div>{recentWorkouts?.length ? recentWorkouts.slice(0,3).map((workout)=><div className="lower-row" key={workout.id}><span className="lower-row-icon"><Dumbbell size={14}/></span><span><strong>{workout.focus_snapshot || weekdays.find((_,i)=>weekdayCode[weekdays[i]]===workout.weekday) || "Workout"}</strong><small>{new Date(`${workout.session_date}T12:00:00`).toLocaleDateString(undefined,{dateStyle:"medium"})} · {Math.round(workout.completion_percent)}% complete</small></span><strong className="lower-row-end">{workout.duration_seconds ? `${Math.round(workout.duration_seconds/60)} min` : `v${workout.plan_version ?? "-"}`}</strong></div>) : <p className="lower-empty">Completed workouts will appear here.</p>}</article>
      <article className="surface-card lower-card"><div className="section-title-row"><div><span className="eyebrow">CHECK-INS</span><h2>Recent measurements</h2></div><Link href="/dashboard/progress" className="subtle-link">Track <ArrowRight size={14}/></Link></div>{recentByMetric.length ? recentByMetric.map((entry)=><div className="lower-row" key={entry.id}><span className="lower-row-icon"><Scale size={14}/></span><span><strong>{entry.custom_name || entry.metric.replace("_"," ")}</strong><small>{new Date(`${entry.measured_at}T12:00:00`).toLocaleDateString(undefined,{dateStyle:"medium"})}</small></span><strong className="lower-row-end">{entry.value} {entry.unit}</strong></div>) : <p className="lower-empty">Add a measurement to start a progress history.</p>}</article>
      <article className="surface-card lower-card shared-summary"><div className="section-title-row"><div><span className="eyebrow">YOUR TEAMMATE</span><h2>Together</h2></div><Link href="/dashboard/together" className="subtle-link">Open <ArrowRight size={14}/></Link></div>{partner ? <><div className="partner-summary"><span className="avatar-placeholder">{(partner.display_name||"P").slice(0,1).toUpperCase()}</span><span><strong>{partner.display_name||"Partner"}</strong><small>{partnerWeight ? `Weight shared: ${partnerWeight.value} ${partnerWeight.unit}` : "See the progress they choose to share"}</small></span></div><p className="lower-empty">Private notes and unapproved progress stay private.</p></> : <div className="partner-summary"><Users size={17}/><span><strong>Pair your accounts</strong><small>Sharing controls stay off until both profiles are linked.</small></span></div>}</article></section>
    <section className="bottom-shortcuts"><Link href="/dashboard/plans"><span><Sparkles size={18} /></span><strong>Manage plans</strong><small>Import, compare, and review versions</small><ArrowRight size={16} /></Link><Link href="/dashboard/progress"><span><Scale size={18} /></span><strong>Track progress</strong><small>Measurements and personal trends</small><ArrowRight size={16} /></Link></section>
  </div>;
}
