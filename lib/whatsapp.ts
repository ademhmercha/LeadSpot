/**
 * Convertit un numéro de téléphone au format international requis par
 * WhatsApp (liens wa.me). Les numéros français « 0X XX XX XX XX » sont
 * automatiquement convertis en « 33X XX XX XX XX », le préfixe international
 * « 00 » est retiré, et les autres formats sont conservés tels quels.
 */
export function toWhatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10)
    return `33${digits.slice(1)}`;
  return digits;
}
