import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PlanManagement, PlanSummary } from "@/components/plans/management";

const planSelection = "id,plan_name,version,status,created_at,source_json,workout_days(id,weekday,day_name,focus,is_rest,workout_plan_exercises(id,position,exercise_snapshot))";

export default async function PlansPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("workout_plans").select(planSelection).order("version", { ascending: false });
  const plans = (data ?? []) as unknown as PlanSummary[];
  const activePlan = plans.find((plan) => plan.status === "active") ?? null;
  return <PlanManagement activePlan={activePlan} history={plans} />;
}
