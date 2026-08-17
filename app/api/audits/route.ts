import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Audit } from "@/lib/types";

/**
 * Crée (ou renvoie) le lien d'audit partageable d'un lead. Un seul audit par
 * lead : l'id uuid généré sert de token public non devinable.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const leadId = typeof body?.leadId === "string" ? body.leadId : "";

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!lead)
    return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });

  const { error: upsertError } = await supabase
    .from("audits")
    .upsert(
      { user_id: user.id, lead_id: leadId },
      { onConflict: "lead_id", ignoreDuplicates: true },
    );
  if (upsertError)
    return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const { data: audit } = await supabase
    .from("audits")
    .select("*")
    .eq("lead_id", leadId)
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ audit: audit as Audit | null });
}

/** Renvoie l'audit d'un lead (ou null s'il n'existe pas encore). */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const leadId = new URL(req.url).searchParams.get("lead_id") ?? "";
  if (!leadId)
    return NextResponse.json({ error: "lead_id requis" }, { status: 400 });

  const { data: audit } = await supabase
    .from("audits")
    .select("*")
    .eq("lead_id", leadId)
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ audit: (audit as Audit | null) ?? null });
}
