import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("saved_zones")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zones: data });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const { category, zoneLabel, lat, lon, radiusKm } = body;

  if (
    !category ||
    !zoneLabel ||
    lat === undefined ||
    lon === undefined ||
    !radiusKm
  ) {
    return NextResponse.json(
      { error: "Paramètres invalides" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("saved_zones")
    .insert({
      user_id: user.id,
      category,
      zone_label: zoneLabel,
      lat,
      lon,
      radius_km: radiusKm,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data });
}
