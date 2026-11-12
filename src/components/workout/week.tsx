"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Check, ChevronDown, Circle, Clock3, Dumbbell, LoaderCircle, Pause, Play, RotateCcw, Search, Sparkles, Timer } from "lucide-react";
import { ExercisePlanInput, weekdays } from "@/lib/plans/schema";
import { EquipmentInformation, ExerciseDemonstration } from "@/components/exercises/exercise-details";

type SetLog = { id: string; set_number: number; actual_weight: number | null; weight_unit: "kg" | "lb"; actual_reps: number | null; duration_seconds: number | null; completed_at: string | null };
type Completion = { id: string; session_id: string; plan_exercise_id: string | null; exercise_name: string; muscle_group: string; exercise_snapshot: ExercisePlanInput; note: string; completed: boolean; set_logs: SetLog[] };
type Day = { id: string; weekday: number; day_name: string; focus: string; is_rest: boolean; workout_plan_exercises: Array<{ id: string; position: number; sets: number; reps_min: number | null; reps_max: number | null; duration_seconds: number | null; rest_seconds: number; exercise_snapshot: ExercisePlanInput }> };
type Session = { id: string; weekday: number; status: "in_progress" | "paused" | "completed"; completion_percent: number; started_at: string; exercise_completions: Completion[] };
const weekdayCodes: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
type Props = { days: Day[]; todayCode: number; timezone: string; existingSessions: Session[]; activePlanName: string };
type SetValues = { weight: string; unit: "kg" | "lb"; reps: string; duration: string; completed: boolean };

export function WorkoutWeek({ days, todayCode, timezone, existingSessions, activePlanName }: Props) {
  const router = useRouter();
  const [selectedCode, setSelectedCode] = useState(todayCode);
  const [session, setSession] = useState<Session | null>(existingSessions.find((item) => item.weekday === todayCode) ?? null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("All muscles");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const selectedDay = days.find((day) => day.weekday === selectedCode) ?? null;
  useEffect(() => { if (secondsLeft === null || secondsLeft <= 0) return; const timer = window.setTimeout(() => setSecondsLeft((value) => value === null ? null : value - 1), 1000); return () => window.clearTimeout(timer); }, [secondsLeft]);

  const muscles = useMemo(() => [...new Set((selectedDay?.workout_plan_exercises ?? []).flatMap((exercise) => [exercise.exercise_snapshot.muscleGroup, ...exercise.exercise_snapshot.targetMuscles]).map((muscle) => muscle.trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b)), [selectedDay]);
  const visibleExercises = useMemo(() => (selectedDay?.workout_plan_exercises ?? []).filter((exercise) => {
    const item = exercise.exercise_snapshot;
    const matchesMuscle = muscleFilter === "All muscles" || item.muscleGroup === muscleFilter || item.targetMuscles.includes(muscleFilter);
    return matchesMuscle && [item.exerciseName, item.muscleGroup, item.description, ...item.targetMuscles, ...item.equipment].join(" ").toLowerCase().includes(search.trim().toLowerCase());
  }), [selectedDay, muscleFilter, search]);
  const completionByPlanExercise = new Map(session?.exercise_completions.map((item) => [item.plan_exercise_id, item]) ?? []);
  const completedCount = selectedDay?.workout_plan_exercises.filter((item) => completionByPlanExercise.get(item.id)?.completed).length ?? 0;
  const progressPercent = selectedDay?.workout_plan_exercises.length ? Math.round(completedCount / selectedDay.workout_plan_exercises.length * 100) : 0;
  const weekdayButtons = weekdays.map((name) => ({ name, code: weekdayCodes[name], day: days.find((entry) => entry.weekday === weekdayCodes[name]) }));
  const isCompleted = session?.status === "completed";
  const canEdit = Boolean(session && !isCompleted);

  async function requestJson(url: string, body: unknown) {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error ?? "The request could not be completed.");
  }
  async function startWorkout() {
    if (!selectedDay) return;
    setLoading(true); setMessage("");
    try { await requestJson("/api/workouts/sessions", { action: "start", weekday: selectedCode }); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not start workout."); }
    finally { setLoading(false); }
  }
  async function changeStatus(status: "in_progress" | "paused" | "completed") {
    if (!session) return;
    if (status === "completed" && !window.confirm("Finish this workout and save it to your history?")) return;
    setLoading(true); setMessage("");
    try { await requestJson("/api/workouts/sessions", { action: "status", sessionId: session.id, status }); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update workout."); }
    finally { setLoading(false); }
  }
  async function saveSet(completion: Completion, number: number, values: SetValues) {
    if (!session) return;
    try { await requestJson("/api/workouts/sets", { sessionId: session.id, completionId: completion.id, setNumber: number, weight: values.weight === "" ? null : Number(values.weight), weightUnit: values.unit, reps: values.reps === "" ? null : Number(values.reps), durationSeconds: values.duration === "" ? null : Number(values.duration), completed: values.completed }); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save set."); }
  }
  async function toggleExercise(completion: Completion, completed: boolean, note: string) {
    if (!session) return;
    try { await requestJson("/api/workouts/exercises", { sessionId: session.id, completionId: completion.id, completed, note }); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save exercise."); }
  }

  return <div className="page-content workout-page">
    <div className="page-heading"><div><p className="eyebrow">{activePlanName}</p><h1>My workout</h1><p className="intro">Choose any day in your plan. Your weekly schedule repeats until your plan changes.</p></div><span className="secure-chip"><Clock3 size={14} /> {timezone}</span></div>
    <div className="weekday-tabs" role="tablist" aria-label="Workout day">{weekdayButtons.map(({ name, code, day }) => <button key={name} role="tab" aria-selected={selectedCode === code} className={`weekday-tab ${selectedCode === code ? "selected" : ""} ${todayCode === code ? "is-today" : ""}`} onClick={() => { setSelectedCode(code); setSession(existingSessions.find((item) => item.weekday === code) ?? null); setMessage(""); }}><span>{name.slice(0, 3)}</span><small>{code === todayCode ? "Today" : day?.is_rest ? "Rest" : `${day?.workout_plan_exercises.length ?? 0} moves`}</small></button>)}</div>
    {!selectedDay ? <section className="surface-card empty-state workout-empty"><Dumbbell size={23} /><strong>This weekday isn’t in the active plan</strong><span>Import a plan with all seven weekdays to see the schedule here.</span></section> : <>
      <section className="workout-summary surface-card"><div><span className="eyebrow">{selectedDay.day_name.toUpperCase()} · {selectedCode === todayCode ? "TODAY" : "PLAN DAY"}</span><h2>{selectedDay.focus || (selectedDay.is_rest ? "Recovery day" : "Workout")}</h2><p>{selectedDay.is_rest ? "A planned pause is part of getting stronger." : `${selectedDay.workout_plan_exercises.length} exercises in your plan`}</p></div>{!selectedDay.is_rest && <div className="summary-progress"><strong>{progressPercent}%</strong><span>{completedCount} of {selectedDay.workout_plan_exercises.length} done</span><div className="progress-track"><span style={{ width: `${progressPercent}%` }} /></div></div>}</section>
      {selectedDay.is_rest || selectedDay.workout_plan_exercises.length === 0 ? <section className="surface-card rest-workout"><Sparkles size={20} /><h2>Recovery is on the schedule</h2><p>No exercises are assigned for {selectedDay.day_name}. Enjoy the rest day and return when you’re ready.</p></section> : <>
        {!session ? <div className="workout-actions"><button className="primary-action" disabled={loading} onClick={startWorkout}>{loading ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />} Start {selectedCode === todayCode ? "today’s" : `${selectedDay.day_name}’s`} workout</button><span>Progress saves to your account as you go.</span></div> : <div className="session-toolbar"><div className="session-state"><span className={`session-status-dot ${session.status}`} /><strong>{isCompleted ? "Workout complete" : session.status === "paused" ? "Workout paused" : "Workout in progress"}</strong><span>{session.completion_percent}% complete</span></div><div className="toolbar-actions">{!isCompleted && (session.status === "paused" ? <button className="secondary-action" onClick={() => changeStatus("in_progress")} disabled={loading}><Play size={15} /> Resume</button> : <button className="secondary-action" onClick={() => changeStatus("paused")} disabled={loading}><Pause size={15} /> Pause</button>)}{!isCompleted && <button className="primary-action" onClick={() => changeStatus("completed")} disabled={loading}><Check size={15} /> Finish workout</button>}</div></div>}
        <div className="exercise-filter-row"><label className="exercise-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercises and equipment" /></label><label className="muscle-select"><Dumbbell size={15} /><select value={muscleFilter} onChange={(event) => setMuscleFilter(event.target.value)}><option>All muscles</option>{muscles.map((muscle) => <option key={muscle}>{muscle}</option>)}</select><ChevronDown size={14} /></label></div>
        {muscles.length > 0 && <div className="muscle-chips"><button className={muscleFilter === "All muscles" ? "active" : ""} onClick={() => setMuscleFilter("All muscles")}>All muscles</button>{muscles.map((muscle) => <button key={muscle} className={muscleFilter === muscle ? "active" : ""} onClick={() => setMuscleFilter(muscle)}>{muscle}</button>)}</div>}
        {message && <p className="alert alert-error" role="alert">{message}</p>}
        <div className="workout-exercise-list">{visibleExercises.length === 0 ? <div className="surface-card empty-state"><Search size={20} /><span>No exercises match these filters.</span></div> : visibleExercises.map((exercise) => { const completion = completionByPlanExercise.get(exercise.id); return <ExerciseCard key={exercise.id} sessionId={session?.id} item={exercise.exercise_snapshot} prescribedSets={exercise.sets} repsMin={exercise.reps_min} repsMax={exercise.reps_max} duration={exercise.duration_seconds} rest={exercise.rest_seconds} completion={completion} disabled={!canEdit} onSaveSet={(number, values) => completion ? saveSet(completion, number, values) : Promise.resolve()} onToggle={(value, note) => completion ? toggleExercise(completion, value, note) : undefined} onRest={() => setSecondsLeft(exercise.rest_seconds)} secondsLeft={secondsLeft} />; })}</div>
      </>}
    </>}
  </div>;
}

function ExerciseCard({ sessionId, item, prescribedSets, repsMin, repsMax, duration, rest, completion, disabled, onSaveSet, onToggle, onRest, secondsLeft }: { sessionId?: string; item: ExercisePlanInput; prescribedSets: number; repsMin: number | null; repsMax: number | null; duration: number | null; rest: number; completion?: Completion; disabled: boolean; onSaveSet: (number: number, values: SetValues) => Promise<void>; onToggle: (completed: boolean, note: string) => void; onRest: () => void; secondsLeft: number | null }) {
  const logs = new Map((completion?.set_logs ?? []).map((log) => [log.set_number, log]));
  const [note, setNote] = useState(completion?.note ?? "");
  const prescribed = duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")} min` : repsMin == null ? "Timed / as prescribed" : repsMin === repsMax ? `${repsMin} reps` : `${repsMin}–${repsMax ?? "?"} reps`;
  const group = [item.muscleGroup, ...item.targetMuscles].filter(Boolean).join(" · ");
  return <article className={`exercise-card surface-card ${completion?.completed ? "done" : ""}`}>
    <div className="exercise-card-heading"><span className="exercise-card-index">{item.exerciseType || "Exercise"}</span>{completion && <button className={`exercise-complete ${completion.completed ? "checked" : ""}`} disabled={disabled} onClick={() => onToggle(!completion.completed, note)}>{completion.completed ? <Check size={14} /> : <Circle size={14} />} {completion.completed ? "Completed" : "Mark complete"}</button>}</div>
    <div className="exercise-card-title"><div><h3>{item.exerciseName}</h3><p>{group}</p></div><span className="exercise-prescription">{prescribedSets} sets · {prescribed}</span></div>
    {item.description && <p className="exercise-description">{item.description}</p>}
    <div className="exercise-facts">{item.equipment.length > 0 && <span><Dumbbell size={13} />{item.equipment.join(", ")}</span>}{rest > 0 && <span><Clock3 size={13} />Rest {rest}s</span>}{item.targetMuscles.length > 0 && <span><Activity size={13} />{item.targetMuscles.join(", ")}</span>}</div>
    {completion && prescribedSets > 0 && <div className="set-table"><div className="set-table-head"><span>SET</span><span>WEIGHT</span><span>{duration ? "TIME" : "REPS"}</span><span>DONE</span></div>{Array.from({ length: prescribedSets }, (_, index) => { const number = index + 1; return <SetRow key={number} number={number} log={logs.get(number)} repsMin={repsMin} duration={duration} disabled={disabled} sessionId={sessionId ?? ""} completionId={completion.id} onSave={onSaveSet} />; })}</div>}
    {completion && <label className="exercise-note">Session note<textarea value={note} onChange={(event) => setNote(event.target.value)} onBlur={() => onToggle(completion.completed, note)} maxLength={2000} placeholder="How did this exercise feel?" disabled={disabled} /></label>}
    {(item.breathing || item.commonMistakes.length || item.trainerNotes) && <details className="exercise-instructions"><summary>Instructions and trainer notes <ChevronDown size={14} /></summary>{item.breathing && <p><strong>Breathing</strong>{item.breathing}</p>}{item.commonMistakes.length > 0 && <p><strong>Common mistakes</strong>{item.commonMistakes.join(" · ")}</p>}{item.trainerNotes && <p><strong>Trainer notes</strong>{item.trainerNotes}</p>}</details>}
    <ExerciseDemonstration media={item.media} legacyImageUrl={item.imageUrl} legacyVideoUrl={item.videoUrl} />
    <EquipmentInformation details={item.equipmentDetails} legacyEquipment={item.equipment} />
    {rest > 0 && <button className="rest-button" onClick={onRest}><Timer size={14} />{secondsLeft !== null && secondsLeft > 0 ? `Rest timer · ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : "Start rest timer"}<RotateCcw size={13} /></button>}
  </article>;
}

function SetRow({ number, log, repsMin, duration, disabled, sessionId, completionId, onSave }: { number: number; log?: SetLog; repsMin: number | null; duration: number | null; disabled: boolean; sessionId: string; completionId: string; onSave: (number: number, values: SetValues) => Promise<void> }) {
  const [weight, setWeight] = useState(log?.actual_weight == null ? "" : String(log.actual_weight));
  const [unit, setUnit] = useState<"kg" | "lb">(log?.weight_unit ?? "kg");
  const [reps, setReps] = useState(log?.actual_reps == null ? "" : String(log.actual_reps));
  const [time, setTime] = useState(log?.duration_seconds == null ? "" : String(log.duration_seconds));
  const [saving, setSaving] = useState(false);
  async function save(completed = log?.completed_at != null) { if (!sessionId || !completionId) return; setSaving(true); await onSave(number, { weight, unit, reps, duration: time, completed }); setSaving(false); }
  return <div className="set-row"><span className="set-number">{String(number).padStart(2, "0")}</span><div className="weight-entry"><input inputMode="decimal" aria-label={`Set ${number} actual weight`} value={weight} onChange={(event) => setWeight(event.target.value)} onBlur={() => save()} placeholder="—" disabled={disabled} /><select aria-label={`Set ${number} weight unit`} value={unit} onChange={(event) => setUnit(event.target.value as "kg" | "lb")} onBlur={() => save()} disabled={disabled}><option>kg</option><option>lb</option></select></div><input className="rep-entry" inputMode="numeric" aria-label={`Set ${number} ${duration ? "duration in seconds" : "repetitions"}`} value={duration ? time : reps} onChange={(event) => duration ? setTime(event.target.value) : setReps(event.target.value)} onBlur={() => save()} placeholder={duration ? `${duration}s` : String(repsMin ?? "—")} disabled={disabled} /><button className={`set-check ${log?.completed_at ? "checked" : ""}`} aria-label={`${log?.completed_at ? "Unmark" : "Mark"} set ${number} complete`} disabled={disabled || saving} onClick={() => save(!log?.completed_at)}>{saving ? <LoaderCircle className="spin" size={15} /> : log?.completed_at ? <Check size={15} /> : <Circle size={15} />}</button></div>;
}
