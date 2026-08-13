import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sendOutreachEmail } from "@/lib/resend";
import { escapeHtml, personalizeMessage } from "@/lib/message";
import type { Lead } from "@/lib/types";

const MAX_RECIPIENTS = 50;

interface RecipientEntry {
  leadId: string;
  message: string;
}

interface SendRequestBody {
  channel: "email" | "whatsapp";
  subject?: string;
  recipients: RecipientEntry[];
}

/** Remplace les placeholders du message/objet par les données du lead. */
function personalizeForLead(text: string, lead: Lead): string {
  return personalizeMessage(text, {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    address: lead.address,
    website: lead.website,
    siret: lead.siret,
    category: lead.category,
  });
}

function buildEmailHtml(message: string, lead: Lead): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;line-height:1.5">
      ${message
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 14px;white-space:pre-wrap">${escapeHtml(p)}</p>`)
        .join("")}
      <p style="margin-top:24px;color:#888;font-size:12px">— ${escapeHtml(lead.name)}${lead.address ? `, ${escapeHtml(lead.address)}` : ""}</p>
    </div>
  `;
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
  const { channel } = body;
  const subject = body.subject?.trim() ?? "";
  const recipients = Array.isArray(body.recipients) ? body.recipients : [];

  if (channel !== "email" && channel !== "whatsapp") {
    return NextResponse.json({ error: "Canal invalide" }, { status: 400 });
  }
  if (recipients.length === 0) {
    return NextResponse.json({ error: "Aucun lead sélectionné" }, { status: 400 });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { error: `Limite de ${MAX_RECIPIENTS} destinataires par envoi` },
      { status: 400 }
    );
  }
  if (
    channel === "email" &&
    (!subject || recipients.some((r) => typeof r.message !== "string" || !r.message.trim()))
  ) {
    return NextResponse.json(
      { error: "L'objet et le message sont requis pour un envoi par email" },
      { status: 400 }
    );
  }

  const leadIds = recipients.map((r) => r.leadId);
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
  const leadById = new Map(leads.map((l) => [l.id, l]));

  // ---------------------------------------------------------------
  // Canal WhatsApp : marque simplement les leads sélectionnés comme
  // « contactés » — l'ouverture des liens wa.me se fait côté navigateur,
  // un par un, par l'utilisateur.
  // ---------------------------------------------------------------
  if (channel === "whatsapp") {
    const { error: updateError } = await supabase
      .from("leads")
      .update({ status: "contacte" })
      .in("id", leadIds)
      .eq("user_id", user.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ sent: leadIds.length, skipped: 0, sentLeadIds: leadIds });
  }

  // ---------------------------------------------------------------
  // Canal email : un email individuel par destinataire (jamais de CCI),
  // avec le message final (relu/édité) de chaque destinataire, puis passage
  // des leads réellement envoyés au statut « contacté ».
  // ---------------------------------------------------------------
  const failures: string[] = [];
  const skippedIds: string[] = [];
  for (const entry of recipients) {
    const lead = leadById.get(entry.leadId);
    if (!lead?.email) {
      skippedIds.push(entry.leadId);
      continue;
    }
    // Le message arrive déjà personnalisé par le client (et éventuellement
    // édité) ; on repasse les placeholders une dernière fois pour rattraper
    // un éventuel {{...}} saisi à la main dans une édition.
    const personalSubject = personalizeForLead(subject, lead);
    const personalMessage = personalizeForLead(entry.message, lead);
    try {
      await sendOutreachEmail({ to: lead.email, subject: personalSubject, html: buildEmailHtml(personalMessage, lead) });
    } catch {
      failures.push(entry.leadId);
    }
  }

  const sentLeadIds = recipients.map((r) => r.leadId).filter((id) => !failures.includes(id) && !skippedIds.includes(id));
  const sent = sentLeadIds.length;

  if (sent > 0) {
    const { error: updateError } = await supabase
      .from("leads")
      .update({ status: "contacte" })
      .in("id", sentLeadIds)
      .eq("user_id", user.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ sent, skipped: skippedIds.length + failures.length, sentLeadIds });
}
