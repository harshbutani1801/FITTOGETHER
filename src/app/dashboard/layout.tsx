import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppNavigation } from "@/components/app/navigation";
import "../globals.css";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const displayName = profile?.display_name || user.email?.split("@")[0] || "Member";
  return <div className="app-frame"><AppNavigation displayName={displayName} /><main className="app-main">{children}</main></div>;
}
