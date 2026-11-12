import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const exerciseSchema = z.object({ sessionId: z.string().uuid(), completionId: z.string().uuid(), completed: z.boolean(), note: z.string().max(2000) });
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save workout progress." }, { status: 401 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = exerciseSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Exercise details are invalid." }, { status: 422 });
  const value = parsed.data;
  const { data: session } = await supabase.from("workout_sessions").select("id").eq("id", value.sessionId).eq("user_id", user.id).in("status", ["in_progress", "paused"]).maybeSingle();
  if (!session) return NextResponse.json({ error: "Workout session not found or no longer editable." }, { status: 404 });
  const { error } = await supabase.from("exercise_completions").update({ completed: value.completed, note: value.note, completed_at: value.completed ? new Date().toISOString() : null }).eq("id", value.completionId).eq("session_id", value.sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { error: progressError } = await supabase.rpc("refresh_workout_progress", { p_session_id: value.sessionId });
  if (progressError) return NextResponse.json({ error: progressError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
