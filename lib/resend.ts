import { Resend } from "resend";
import type { Lead } from "./types";

let client: Resend | null = null;

function getResend(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY!);
  }
  return client;
}

const FROM_ADDRESS = "LeadSpot <onboarding@resend.dev>"; // Resend's free-tier sandbox sender.

export async function sendNewLeadsAlertEmail(opts: {
  to: string;
  zoneLabel: string;
  category: string;
  leads: Lead[];
}): Promise<void> {
  const resend = getResend();
  const { to, zoneLabel, category, leads } = opts;

  const rows = leads
    .map(
      (l) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${l.name}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee">${l.address ?? "-"}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee">${l.phone ?? "-"}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2>LeadSpot — ${leads.length} nouveau(x) lead(s)</h2>
      <p>Zone : <strong>${zoneLabel}</strong> — Catégorie : <strong>${category}</strong></p>
      <table style="border-collapse:collapse;width:100%">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 10px">Nom</th>
            <th style="text-align:left;padding:6px 10px">Adresse</th>
            <th style="text-align:left;padding:6px 10px">Téléphone</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:20px;color:#666;font-size:13px">
        Connectez-vous à LeadSpot pour voir le détail et mettre à jour le statut de ces leads.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `LeadSpot : ${leads.length} nouveau(x) lead(s) à ${zoneLabel}`,
    html,
  });
}
