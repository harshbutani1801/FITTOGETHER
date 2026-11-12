"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronDown, Download, FileJson2, Layers3, LoaderCircle, Upload } from "lucide-react";
import { WorkoutPlanInput, workoutPlanSchema, weekdays } from "@/lib/plans/schema";
import { ManualPlanEditor } from "@/components/plans/manual-editor";

export type PlanSummary = {
  id: string;
  plan_name: string;
  version: number;
  status: "active" | "archived";
  created_at: string;
  source_json: unknown;
  workout_days: Array<{ id: string; weekday: number; day_name: string; focus: string; is_rest: boolean; workout_plan_exercises: Array<{ id: string; position: number; sets?: number; reps_min?: number | null; reps_max?: number | null; duration_seconds?: number | null; rest_seconds?: number; exercise_snapshot: Record<string, unknown> }> }>;
};

type ValidationIssue = { path: string; message: string };

function planStats(plan: PlanSummary | WorkoutPlanInput) {
  const days = "workout_days" in plan ? plan.workout_days : plan.workoutDays;
  const exercises = days.reduce((total, day) => total + ("workout_plan_exercises" in day ? day.workout_plan_exercises.length : day.exercises.length), 0);
  const trainingDays = days.filter((day) => "is_rest" in day ? !day.is_rest : day.exercises.length > 0).length;
  return { days: days.length, exercises, trainingDays };
}

function displayDays(plan: PlanSummary | WorkoutPlanInput) {
  if ("workout_days" in plan) return [...plan.workout_days].sort((a, b) => a.weekday - b.weekday).map((day) => ({ name: day.day_name, focus: day.focus, count: day.workout_plan_exercises.length, items: day.workout_plan_exercises.map((exercise) => exercise.exercise_snapshot) }));
  return weekdays.map((name) => {
    const day = plan.workoutDays.find((entry) => entry.day === name)!;
    return { name, focus: day.focus, count: day.exercises.length, items: day.exercises as unknown as Record<string, unknown>[] };
  });
}

function PlanColumn({ title, days }: { title: string; days: ReturnType<typeof displayDays> }) {
  return <div className="comparison-column"><h3>{title}</h3>{days.map((day) => <div className="comparison-day" key={day.name}><div><strong>{day.name}</strong><span>{day.focus || "No focus set"}</span></div><span className="count-pill">{day.count} {day.count === 1 ? "exercise" : "exercises"}</span></div>)}</div>;
}

export function PlanManagement({ activePlan, history }: { activePlan: PlanSummary | null; history: PlanSummary[] }) {
  const router = useRouter();
  const [parsedPlan, setParsedPlan] = useState<WorkoutPlanInput | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const stats = useMemo(() => parsedPlan ? planStats(parsedPlan) : null, [parsedPlan]);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setIssues([]); setError(""); setNotice(""); setParsedPlan(null); setFileName(file?.name ?? "");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) { setError("Choose a .json workout plan file."); return; }
    if (file.size > 2_000_000) { setError("This file is too large. Keep workout plans under 2 MB."); return; }
    try {
      const raw: unknown = JSON.parse(await file.text());
      const result = workoutPlanSchema.safeParse(raw);
      if (!result.success) {
        setIssues(result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
        setError("Review the validation issues below and upload a corrected plan.");
        return;
      }
      setParsedPlan(result.data);
    } catch {
      setError("This file could not be read as JSON. Check its syntax and try again.");
    }
  }

  async function activatePlan() {
    if (!parsedPlan) return;
    const confirmed = window.confirm(`Activate “${parsedPlan.planName}” as the new active plan? Your current plan will be archived. Previous plan versions and workout history will be kept.`);
    if (!confirmed) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/plans/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsedPlan) });
      const body = await response.json() as { error?: string; issues?: ValidationIssue[]; message?: string };
      if (!response.ok) {
        setError(body.error ?? "Plan activation failed.");
        setIssues(body.issues ?? []);
        return;
      }
      setNotice(body.message ?? "Plan activated.");
      setParsedPlan(null); setFileName("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Your current plan has not been changed.");
    } finally { setBusy(false); }
  }

  function downloadDraftJson(plan: WorkoutPlanInput) {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${plan.planName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-draft.json`;
    link.click(); URL.revokeObjectURL(url);
  }

  function downloadJson(plan: PlanSummary) {
    const blob = new Blob([JSON.stringify(plan.source_json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${plan.plan_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-v${plan.version}.json`;
    link.click(); URL.revokeObjectURL(url);
  }

  const uploadedDays = parsedPlan ? displayDays(parsedPlan) : [];
  const currentDays = activePlan ? displayDays(activePlan) : [];

  function previewManualPlan(plan: WorkoutPlanInput) { setParsedPlan(plan); setFileName("Manual plan editor"); setIssues([]); setError(""); setNotice(""); }

  return <div className="page-content">
    <div className="page-heading"><div><p className="eyebrow">YOUR TRAINING, YOUR WAY</p><h1>Plan management</h1><p className="intro">Import a trainer’s plan, review it, then activate it for your weekly routine.</p></div><span className="secure-chip"><Check size={14} /> Private to your account</span></div>
    <section className="surface-card import-card"><div className="section-title-row"><div><h2>Import a workout plan</h2><p>Upload a JSON plan. Your signed-in account owns the new version automatically.</p></div><span className="file-icon"><FileJson2 size={21} /></span></div><label className="upload-zone"><input type="file" accept="application/json,.json" onChange={chooseFile} /><span className="upload-symbol"><Upload size={21} /></span><strong>{fileName || "Choose a JSON file to upload"}</strong><span>Seven weekdays · JSON format · up to 2 MB</span><span className="upload-action">Browse files</span></label>
      {error && <div className="alert alert-error" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}{notice && <div className="alert alert-success" role="status"><Check size={17} /><span>{notice}</span></div>}
      {issues.length > 0 && <ul className="validation-list">{issues.slice(0, 12).map((issue, index) => <li key={`${issue.path}-${index}`}><strong>{issue.path || "Plan"}</strong> {issue.message}</li>)}</ul>}
      {parsedPlan && stats && <div className="plan-preview"><div className="preview-heading"><div><span className="eyebrow">READY TO REVIEW</span><h3>{parsedPlan.planName}</h3></div><div className="stat-chips"><span>{stats.trainingDays} training days</span><span>{stats.exercises} exercises</span></div></div><p className="binding-note">Any user ID inside the file is ignored. This plan will be bound to your signed-in account.</p>
        <details className="weekday-preview"><summary>Review all seven weekdays <ChevronDown size={16} /></summary><div className="weekday-grid">{uploadedDays.map((day) => <article className="weekday-card" key={day.name}><div className="weekday-card-head"><strong>{day.name}</strong><span>{day.count}</span></div><p>{day.focus || "No focus set"}</p>{day.items.slice(0, 4).map((item, index) => <span className="preview-exercise" key={index}>{String(item.exerciseName ?? "Exercise")}{item.muscleGroup ? ` · ${String(item.muscleGroup)}` : ""}</span>)}{day.count > 4 && <span className="preview-exercise muted">+{day.count - 4} more</span>}</article>)}</div></details>
        {activePlan && <div className="compare-wrap"><div className="section-title-row"><div><h3>Compare with your active plan</h3><p>Current version {activePlan.version} will be archived after confirmation.</p></div><span className="compare-arrow">?</span></div><div className="compare-grid"><PlanColumn title={`Current · ${activePlan.plan_name}`} days={currentDays} /><PlanColumn title={`New · ${parsedPlan.planName}`} days={uploadedDays} /></div></div>}
        {fileName === "Manual plan editor" && <button className="secondary-action draft-export" onClick={() => downloadDraftJson(parsedPlan)}>Export draft JSON</button>}
        <button className="primary-action" onClick={activatePlan} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{busy ? "Activating plan…" : activePlan ? "Confirm and activate new version" : "Activate this plan"}</button>
      </div>}
    </section>
    <section className="surface-card version-card"><div className="section-title-row"><div><h2>Plan version history</h2><p>Archived plans stay available for download and comparison.</p></div><span className="version-count">{history.length} {history.length === 1 ? "version" : "versions"}</span></div>{history.length === 0 ? <div className="empty-state"><Layers3 size={22} /><strong>No plans imported yet</strong><span>Your plan versions will appear here.</span></div> : <div className="version-list">{history.map((plan) => { const versionStats = planStats(plan); const expanded = expandedVersion === plan.id; return <article className="version-row" key={plan.id}><div className="version-main"><span className={`status-dot ${plan.status}`} /><div><div className="version-title"><strong>{plan.plan_name}</strong><span className={`status-label ${plan.status}`}>{plan.status}</span><span className="version-number">v{plan.version}</span></div><p>{new Date(plan.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })} · {versionStats.days} days · {versionStats.exercises} exercises</p></div></div><div className="version-actions"><button className="text-action" onClick={() => setExpandedVersion(expanded ? null : plan.id)}>{expanded ? "Hide days" : "View days"}</button><button className="icon-action" onClick={() => downloadJson(plan)} aria-label={`Download ${plan.plan_name} version ${plan.version} as JSON`}><Download size={16} /></button></div>{expanded && <div className="version-day-list">{displayDays(plan).map((day) => <span key={day.name}><strong>{day.name}</strong> · {day.focus} · {day.count} exercises</span>)}</div>}</article>; })}</div>}</section>
    <ManualPlanEditor onPreview={previewManualPlan} />
  </div>;
}
