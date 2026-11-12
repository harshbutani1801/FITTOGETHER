import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { workoutPlanSchema } from "@/lib/plans/schema";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to import a plan." }, { status: 401 });

  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "The uploaded file is not valid JSON." }, { status: 400 }); }

  const result = workoutPlanSchema.safeParse(payload);
  if (!result.success) {
    return NextResponse.json({ error: "The workout plan has validation errors.", issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 422 });
  }

  // Any userId in the file is informational only. The database RPC binds the plan to auth.uid().
  const { data: planId, error } = await supabase.rpc("import_workout_plan", { p_plan: result.data });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ planId, message: "Plan activated successfully." }, { status: 201 });
}
