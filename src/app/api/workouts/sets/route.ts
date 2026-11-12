import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const setSchema = z.object({ sessionId: z.string().uuid(), completionId: z.string().uuid(), setNumber: z.number().int().min(1), weight: z.number().min(0).nullable(), weightUnit: z.enum(["kg", "lb"]), reps: z.number().int().min(0).nullable(), durationSeconds: z.number().int().min(0).nullable(), completed: z.boolean() });

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save workout progress." }, { status: 401 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = setSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Set details are invalid.", issues: parsed.error.issues.map((issue) => issue.message) }, { status: 422 });
  const value = parsed.data;
  const { error } = await supabase.rpc("record_workout_set", { p_session_id: value.sessionId, p_completion_id: value.completionId, p_set_number: value.setNumber, p_weight: value.weight, p_weight_unit: value.weightUnit, p_reps: value.reps, p_duration_seconds: value.durationSeconds, p_completed: value.completed });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
