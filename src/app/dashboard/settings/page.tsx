import SettingsClient from "@/components/settings/form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;
  const [{ data: profile }, { data: sharing }, { data: preferences }] = await Promise.all([
    supabase.from("profiles").select("display_name,timezone").eq("id", user.id).maybeSingle(),
    supabase.from("sharing_preferences").select("share_weight,share_measurements,share_workout_history,share_exercise_performance,share_progress_photos").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_preferences").select("timezone,weight_unit,length_unit").eq("user_id", user.id).maybeSingle(),
  ]);
  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Member";
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">YOUR ACCOUNT, YOUR RULES</p><h1>Settings</h1><p className="intro">Manage your profile, units, timezone, and what you share with your partner.</p></div></div><SettingsClient userId={user.id} initialName={name} initialTimezone={preferences?.timezone ?? profile?.timezone ?? "Asia/Kolkata"} initialWeightUnit={preferences?.weight_unit ?? "kg"} initialLengthUnit={preferences?.length_unit ?? "cm"} sharing={sharing ?? { share_weight:false, share_measurements:false, share_workout_history:false, share_exercise_performance:false, share_progress_photos:false }} email={user.email ?? ""} /></div>;
}
