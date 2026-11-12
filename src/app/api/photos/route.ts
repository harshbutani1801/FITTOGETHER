import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const photoCreate = z.object({ storagePath: z.string().min(1).max(500), capturedAt: z.string().date(), caption: z.string().max(500).default(""), shareWithPartner: z.boolean().default(false) });
const photoPatch = z.object({ id: z.string().uuid(), caption: z.string().max(500).optional(), shareWithPartner: z.boolean().optional() });
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Sign in to add a progress photo." }, { status: 401 });
  let payload: unknown; try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = photoCreate.safeParse(payload); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Photo details are invalid." }, { status: 422 });
  if (!parsed.data.storagePath.startsWith(`${user.id}/`)) return NextResponse.json({ error: "Photo path does not belong to your account." }, { status: 403 });
  const { data, error } = await supabase.from("progress_photos").insert({ user_id: user.id, storage_path: parsed.data.storagePath, captured_at: parsed.data.capturedAt, caption: parsed.data.caption, share_with_partner: parsed.data.shareWithPartner }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ id: data.id });
}
export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Sign in to update this photo." }, { status: 401 });
  let payload: unknown; try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = photoPatch.safeParse(payload); if (!parsed.success) return NextResponse.json({ error: "Photo details are invalid." }, { status: 422 });
  const updates: Record<string, string | boolean> = {}; if (parsed.data.caption !== undefined) updates.caption = parsed.data.caption; if (parsed.data.shareWithPartner !== undefined) updates.share_with_partner = parsed.data.shareWithPartner;
  const { data, error } = await supabase.from("progress_photos").update(updates).eq("id", parsed.data.id).eq("user_id", user.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 }); if (!data) return NextResponse.json({ error: "Photo not found." }, { status: 404 }); return NextResponse.json({ ok: true });
}
export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Sign in to delete this photo." }, { status: 401 });
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id")); if (!id.success) return NextResponse.json({ error: "Photo ID is invalid." }, { status: 400 });
  const { data: photo, error: findError } = await supabase.from("progress_photos").select("id,storage_path").eq("id", id.data).eq("user_id", user.id).maybeSingle(); if (findError) return NextResponse.json({ error: findError.message }, { status: 400 }); if (!photo) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  const { error: storageError } = await supabase.storage.from("progress-photos").remove([photo.storage_path]); if (storageError) return NextResponse.json({ error: storageError.message }, { status: 400 });
  const { error } = await supabase.from("progress_photos").delete().eq("id", photo.id).eq("user_id", user.id); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ ok: true });
}
