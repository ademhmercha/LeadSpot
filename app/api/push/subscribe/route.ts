import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Enregistre un abonnement Web Push pour l'utilisateur connecté (RLS : seule
 * la ligne de l'utilisateur courant est insérable). Un même endpoint déjà
 * présent est simplement mis à jour (nouvelle paire de clés).
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { endpoint?: unknown; p256dh?: unknown; auth?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide" },
      { status: 400 },
    );
  }

  const { endpoint, p256dh, auth } = body;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    return NextResponse.json({ error: "Endpoint invalide" }, { status: 400 });
  }
  if (typeof p256dh !== "string" || p256dh === "") {
    return NextResponse.json(
      { error: "Clé p256dh manquante" },
      { status: 400 },
    );
  }
  if (typeof auth !== "string" || auth === "") {
    return NextResponse.json({ error: "Clé auth manquante" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
