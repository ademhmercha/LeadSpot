import { createServiceRoleClient } from "./supabase-server";
import type { UsageInfo } from "./types";

export function currentPeriod(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getMonthlySearchLimit(): number {
  const raw = process.env.FREE_TIER_MONTHLY_SEARCH_LIMIT;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

/** Read-only usage lookup, used to render remaining quota in the UI. */
export async function getUsage(userId: string): Promise<UsageInfo> {
  const supabase = createServiceRoleClient();
  const period = currentPeriod();
  const limit = getMonthlySearchLimit();

  const { data } = await supabase
    .from("usage")
    .select("search_count")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  const searchCount = data?.search_count ?? 0;
  return { period, searchCount, limit, remaining: Math.max(0, limit - searchCount) };
}

/**
 * Atomically increments this month's search counter for `userId` via the
 * `increment_usage` Postgres function (see supabase/schema.sql) and reports
 * whether the user was still under quota *before* this call.
 */
export async function tryConsumeSearchQuota(
  userId: string
): Promise<{ allowed: boolean; usage: UsageInfo }> {
  const supabase = createServiceRoleClient();
  const period = currentPeriod();
  const limit = getMonthlySearchLimit();

  const { data: existing } = await supabase
    .from("usage")
    .select("search_count")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();

  const currentCount = existing?.search_count ?? 0;
  if (currentCount >= limit) {
    return { allowed: false, usage: { period, searchCount: currentCount, limit, remaining: 0 } };
  }

  const { data: newCount, error } = await supabase.rpc("increment_usage", {
    p_user_id: userId,
    p_period: period,
  });
  if (error) throw error;

  return {
    allowed: true,
    usage: { period, searchCount: newCount as number, limit, remaining: Math.max(0, limit - (newCount as number)) },
  };
}
