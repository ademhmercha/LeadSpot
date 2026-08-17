import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { verifyQstashSignature } from "@/lib/qstash-verify";

/**
 * Supabase free-tier projects get auto-paused after ~7 days with no traffic.
 * QStash calls this route every 3-4 days (see lib/qstash.ts) to run a
 * trivial DB read and keep the project active between weekly rescans.
 */
export async function POST(req: NextRequest) {
  const verified = await verifyQstashSignature(req);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("keepalive_pings")
    .select("pinged_at")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("keepalive_pings")
    .update({ pinged_at: new Date().toISOString() })
    .eq("id", true);

  return NextResponse.json({
    ok: true,
    lastPing: data?.pinged_at ?? null,
    pingedAt: new Date().toISOString(),
  });
}

// Convenience for manual/browser testing; QStash always sends POST.
export async function GET(req: NextRequest) {
  return POST(req);
}
