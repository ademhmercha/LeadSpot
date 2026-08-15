/**
 * Utilitaire partagé entre la route API d'envoi et le composeur de messages :
 * les placeholders {{name}} / {{email}} / {{phone}} / {{address}} ... écrits
 * par l'utilisateur sont remplacés automatiquement par les données de chaque
 * lead — l'utilisateur n'a jamais à remplacer manuellement les coordonnées du
 * destinataire.
 *
 * Un placeholder inconnu (coquille) est conservé tel quel pour être visible.
 */
export function personalizeMessage(
  message: string,
  vars: Record<string, string | null | undefined>
): string {
  return message.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in vars)) return match;
    return vars[key] ?? "";
  });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Liste des placeholders disponibles, dans l'ordre d'affichage. */
export const MESSAGE_PLACEHOLDERS: { token: string; label: string }[] = [
  { token: "{{name}}", label: "Nom" },
  { token: "{{email}}", label: "Email" },
  { token: "{{phone}}", label: "Téléphone" },
  { token: "{{address}}", label: "Adresse" },
  { token: "{{website}}", label: "Site web" },
  { token: "{{siret}}", label: "SIRET" },
  { token: "{{category}}", label: "Catégorie" },
];

/**
 * Message de prospection par défaut (composeur + lien mailto rapide) :
 * présente l'expéditeur avant la proposition de création de site web.
 * {{name}} est remplacé par le nom du lead à l'envoi.
 */
export const DEFAULT_OUTREACH_MESSAGE =
  "Bonjour,\n\nJe suis développeur web freelance et j'accompagne les commerçants et les entreprises locales dans la création de leur site internet.\n\nEn consultant les commerces de votre secteur, j'ai remarqué que {{name}} ne dispose pas encore de site web. Un site simple et moderne est aujourd'hui essentiel pour être trouvé sur Google et attirer de nouveaux clients.\n\nJe serais ravi de vous proposer une solution adaptée à votre activité et à votre budget, sans engagement. Souhaitez-vous en discuter ?";

/** Objet de l'email de prospection par défaut (supporte les placeholders). */
export const DEFAULT_OUTREACH_SUBJECT = "Un site web pour {{name}}";
