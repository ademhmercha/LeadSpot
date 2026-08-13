/**
 * Utilitaire partagé entre la route API d'envoi et le composeur de messages :
 * les placeholders {{name}} / {{address}} écrits par l'utilisateur sont
 * remplacés par les données de chaque lead, pour que chaque destinataire
 * reçoive un message personnalisé.
 */
export function personalizeMessage(
  message: string,
  vars: { name: string; address?: string | null }
): string {
  return message
    .replace(/\{\{\s*name\s*\}\}/g, vars.name)
    .replace(/\{\{\s*address\s*\}\}/g, vars.address ?? "");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
