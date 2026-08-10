import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { LEAD_STATUSES } from "@/lib/types";

interface RouteParams {
  params: { id: string };
}

type FieldResult = { ok: true; value: unknown } | { ok: false; error: string };

function isValidEmail(email: string): boolean {
  const [local, domain, ...rest] = email.split("@");
  return Boolean(local) && Boolean(domain) && rest.length === 0 && domain.includes(".") && !domain.startsWith(".");
}

function parseStatus(value: unknown): FieldResult {
  if (!LEAD_STATUSES.includes(value as (typeof LEAD_STATUSES)[number])) {
    return { ok: false, error: "Statut invalide" };
  }
  return { ok: true, value };
}

function parseNotes(value: unknown): FieldResult {
  if (typeof value !== "string") return { ok: false, error: "Notes invalides" };
  return { ok: true, value: value.slice(0, 5000) };
}

function parsePhone(value: unknown): FieldResult {
  if (typeof value !== "string") return { ok: false, error: "Téléphone invalide" };
  const phone = value.trim();
  return { ok: true, value: phone === "" ? null : phone.slice(0, 40) };
}

function parseEmail(value: unknown): FieldResult {
  if (typeof value !== "string") return { ok: false, error: "Adresse email invalide" };
  const email = value.trim();
  if (email !== "" && !isValidEmail(email)) return { ok: false, error: "Adresse email invalide" };
  return { ok: true, value: email === "" ? null : email.slice(0, 200) };
}

const FIELD_PARSERS: Record<string, (value: unknown) => FieldResult> = {
  status: parseStatus,
  notes: parseNotes,
  phone: parsePhone,
  email: parseEmail,
};

/**
 * Builds the partial update for a PATCH request. Returns either the fields
 * to persist, or an error message if the payload was invalid. `phone`/
 * `email` are here so a user can manually fill in contact info they found
 * themselves (e.g. on Google Maps) when Geoapify's OSM-derived data has
 * none for that establishment.
 */
function buildLeadUpdate(body: Record<string, unknown>): { update: Record<string, unknown> } | { error: string } {
  const update: Record<string, unknown> = {};

  for (const [field, parse] of Object.entries(FIELD_PARSERS)) {
    if (body[field] === undefined) continue;
    const result = parse(body[field]);
    if (!result.ok) return { error: result.error };
    update[field] = result.value;
  }

  return { update };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const result = buildLeadUpdate(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const { update } = result;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("leads")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });

  return NextResponse.json({ lead: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { error } = await supabase.from("leads").delete().eq("id", params.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
