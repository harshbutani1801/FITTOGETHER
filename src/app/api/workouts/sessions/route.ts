import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const startSchema = z.object({ action: z.literal("start"), weekday: z.number().int().min(0).max(6) });
const statusSchema = z.object({ action: z.literal("status"), sessionId: z.string().uuid(), status: z.enum(["in_progress", "paused", "completed", "abandoned"]) });

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to start a workout." }, { status: 401 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const start = startSchema.safeParse(payload);
  if (start.success) {
    const { data, error } = await supabase.rpc("start_workout", { p_weekday: start.data.weekday });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ sessionId: data });
  }
  const status = statusSchema.safeParse(payload);
  if (status.success) {
    const { error } = await supabase.rpc("set_workout_status", { p_session_id: status.data.sessionId, p_status: status.data.status });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Invalid workout request.", issues: [...start.error.issues, ...status.error.issues].map((issue) => issue.message) }, { status: 422 });
}
