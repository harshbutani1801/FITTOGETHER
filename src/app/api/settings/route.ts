import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({ displayName: z.string().trim().min(1).max(80), timezone: z.string().trim().min(1).max(80), weightUnit: z.enum(["kg","lb"]), lengthUnit: z.enum(["cm","in"]), shareWeight: z.boolean(), shareMeasurements: z.boolean(), shareWorkoutHistory: z.boolean(), shareExercisePerformance: z.boolean(), shareProgressPhotos: z.boolean() });
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error:"Sign in to update settings." },{status:401});
  let payload: unknown; try { payload = await request.json(); } catch { return NextResponse.json({error:"Invalid request body."},{status:400}); }
  const parsed=schema.safeParse(payload); if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Settings are invalid."},{status:422}); const v=parsed.data;
  try { new Intl.DateTimeFormat("en-US", { timeZone: v.timezone }); } catch { return NextResponse.json({ error: "Enter a valid IANA timezone, such as Asia/Kolkata." }, { status: 422 }); }
  const profile=await supabase.from("profiles").update({display_name:v.displayName,timezone:v.timezone}).eq("id",user.id); if(profile.error)return NextResponse.json({error:profile.error.message},{status:400});
  const prefs=await supabase.from("user_preferences").upsert({user_id:user.id,timezone:v.timezone,weight_unit:v.weightUnit,length_unit:v.lengthUnit}); if(prefs.error)return NextResponse.json({error:prefs.error.message},{status:400});
  const sharing=await supabase.from("sharing_preferences").upsert({user_id:user.id,share_weight:v.shareWeight,share_measurements:v.shareMeasurements,share_workout_history:v.shareWorkoutHistory,share_exercise_performance:v.shareExercisePerformance,share_progress_photos:v.shareProgressPhotos}); if(sharing.error)return NextResponse.json({error:sharing.error.message},{status:400});
  return NextResponse.json({ok:true});
}
