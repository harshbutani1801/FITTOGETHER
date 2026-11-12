import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProgressManager } from "@/components/progress/manager";

export default async function ProgressPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;
  const [{ data: measurementRows }, { data: photoRows }, { data: preferences }, { data: sessionRows }] = await Promise.all([
    supabase.from("my_body_measurements").select("id,measured_at,metric,custom_name,value,unit,note").eq("user_id", user.id).order("measured_at", { ascending: false }),
    supabase.from("progress_photos").select("id,storage_path,captured_at,caption,share_with_partner").eq("user_id", user.id).order("captured_at", { ascending: false }),
    supabase.from("user_preferences").select("weight_unit").eq("user_id", user.id).maybeSingle(),
    supabase.from("workout_sessions").select("id,session_date,completion_percent,exercise_completions(exercise_name,set_logs(set_number,actual_weight,weight_unit,actual_reps,completed_at))").eq("user_id", user.id).eq("status", "completed").order("session_date", { ascending: true }).limit(365),
  ]);
  const photos = await Promise.all((photoRows ?? []).map(async (photo) => { const { data } = await supabase.storage.from("progress-photos").createSignedUrl(photo.storage_path, 3600); return { ...photo, url: data?.signedUrl ?? "" }; }));
  const measurements = measurementRows ?? [];
  const now = Date.now(); // eslint-disable-line react-hooks/purity
  const analytics = sessionRows ?? [];
  const stateKey = `${measurements.map((item) => `${item.id}-${item.value}-${item.measured_at}`).join("|")}:${photos.map((item) => `${item.id}-${item.share_with_partner}`).join("|")}:${analytics.map((item) => `${item.id}-${item.completion_percent}`).join("|")}`;
  return <ProgressManager key={stateKey} initialMeasurements={measurements} photos={photos.filter((photo) => photo.url)} userId={user.id} now={now} analytics={analytics as never} defaultUnit={(preferences?.weight_unit as "kg" | "lb") ?? "kg"} />;
}
