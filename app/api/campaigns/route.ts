import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sendOutreachEmail } from "@/lib/resend";
import { escapeHtml, personalizeMessage } from "@/lib/message";
import type { Lead } from "@/lib/types";

const MAX_RECIPIENTS = 50;

interface SendRequestBody {
  channel: "email" | "whatsapp";
  leadIds: string[];
  subject?: string;
  message?: string;
}

/** Remplace les placeholders {{name}} / {{address}} par les données du lead. */
function personalizeForLead(message: string, lead: Lead): string {
  return personalizeMessage(message, { name: lead.name, address: lead.address });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = (await req.json()) as SendRequestBody;
  const { channel, leadIds } = body;
  const subject = body.subject?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (channel !== "email" && channel !== "whatsapp") {
    return NextResponse.json({ error: "Canal invalide" }, { status: 400 });
  }
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "Aucun lead sélectionné" }, { status: 400 });
  }
  if (leadIds.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { error: `Limite de ${MAX_RECIPIENTS} destinataires par envoi` },
      { status: 400 }
    );
  }
  if (channel === "email" && (!subject || !message)) {
    return NextResponse.json(
      { error: "L'objet et le message sont requis pour un envoi par email" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .in("id", leadIds)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const leads = (data ?? []) as Lead[];
  if (leads.length === 0) {
    return NextResponse.json({ error: "Aucun lead trouvé" }, { status: 404 });
  }

  // ---------------------------------------------------------------
  // Canal WhatsApp : marque simplement les leads sélectionnés comme
  // « contactés » — l'ouverture des liens wa.me se fait côté navigateur,
  // un par un, par l'utilisateur.
  // ---------------------------------------------------------------
  if (channel === "whatsapp") {
    const sentIds = leads.map((l) => l.id);
    const { error: updateError } = await supabase
      .from("leads")
      .update({ status: "contacte" })
      .in("id", sentIds)
      .eq("user_id", user.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ sent: sentIds.length, skipped: 0, sentLeadIds: sentIds });
  }

  // ---------------------------------------------------------------
  // Canal email : un email individuel par destinataire (jamais de CCI),
  // puis passage des leads réellement envoyés au statut « contacté ».
  // ---------------------------------------------------------------
  const withEmail = leads.filter((l): l is Lead & { email: string } => Boolean(l.email));
  const skipped = leads.filter((l) => !l.email);
  if (withEmail.length === 0) {
    return NextResponse.json({
      error: "Aucun lead sélectionné n'a d'adresse email.",
      sent: 0,
      skipped: skipped.length,
      sentLeadIds: [],
    });
  }

  const failures: string[] = [];
  for (const lead of withEmail) {
    const personalMessage = personalizeForLead(message, lead);
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;line-height:1.5">
        ${personalMessage
          .split(/\n{2,}/)
          .map((p) => `<p style="margin:0 0 14px;white-space:pre-wrap">${escapeHtml(p)}</p>`)
          .join("")}
        <p style="margin-top:24px;color:#888;font-size:12px">— ${escapeHtml(lead.name)}${lead.address ? `, ${escapeHtml(lead.address)}` : ""}</p>
      </div>
    `;
    try {
      await sendOutreachEmail({ to: lead.email, subject, html });
    } catch {
      failures.push(lead.id);
    }
  }

  const sentLeadIds = withEmail.filter((l) => !failures.includes(l.id)).map((l) => l.id);
  const sent = sentLeadIds.length;

  if (sent > 0) {
    const { error: updateError } = await supabase
      .from("leads")
      .update({ status: "contacte" })
      .in("id", sentLeadIds)
      .eq("user_id", user.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ sent, skipped: skipped.length + failures.length, sentLeadIds });
}
