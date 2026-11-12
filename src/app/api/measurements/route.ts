import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const measurementSchema = z.object({ id: z.string().uuid().optional(), measuredAt: z.string().date(), metric: z.enum(["weight","chest","waist","hips","arms","thighs","body_fat","custom"]), customName: z.string().trim().max(60).optional(), value: z.number().finite().positive().max(1000), unit: z.enum(["kg","lb","cm","in","%"]), note: z.string().max(1000).default("") }).superRefine((data, context) => { if (data.metric === "custom" && !data.customName) context.addIssue({ code: "custom", path: ["customName"], message: "Name your custom measurement." }); if (data.metric === "weight" && !["kg","lb"].includes(data.unit)) context.addIssue({ code: "custom", path: ["unit"], message: "Weight must use kg or lb." }); if (data.metric === "body_fat" && data.unit !== "%") context.addIssue({ code: "custom", path: ["unit"], message: "Body fat must use percent." }); if (["chest","waist","hips","arms","thighs"].includes(data.metric) && !["cm","in"].includes(data.unit)) context.addIssue({ code: "custom", path: ["unit"], message: "Body measurements must use cm or in." }); });

async function currentUser() { const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser(); return { supabase, user }; }
export async function POST(request: Request) {
  const { supabase, user } = await currentUser(); if (!user) return NextResponse.json({ error: "Sign in to save measurements." }, { status: 401 });
  let payload: unknown; try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = measurementSchema.safeParse(payload); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Measurement is invalid." }, { status: 422 });
  const { id, measuredAt, metric, customName, value, unit, note } = parsed.data; const row = { measured_at: measuredAt, metric, custom_name: customName ?? null, value, unit, note };
  const result = id ? await supabase.from("body_measurements").update(row).eq("id", id).eq("user_id", user.id).select("id").maybeSingle() : await supabase.from("body_measurements").insert({ ...row, user_id: user.id }).select("id").single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  if (!result.data) return NextResponse.json({ error: "Measurement not found." }, { status: 404 });
  return NextResponse.json({ id: result.data.id });
}
export async function DELETE(request: Request) {
  const { supabase, user } = await currentUser(); if (!user) return NextResponse.json({ error: "Sign in to delete measurements." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id"); const parsedId = z.string().uuid().safeParse(id); if (!parsedId.success) return NextResponse.json({ error: "Measurement ID is invalid." }, { status: 400 });
  const { error, count } = await supabase.from("body_measurements").delete({ count: "exact" }).eq("id", parsedId.data).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 }); if (!count) return NextResponse.json({ error: "Measurement not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
