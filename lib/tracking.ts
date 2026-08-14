import { createHmac, timingSafeEqual } from "crypto";

/**
 * Suivi d'ouverture des emails de prospection — pixel invisible auto-hébergé
 * (aucun service tiers ni webhook à configurer). L'URL du pixel contient
 * l'id du lead et une signature HMAC-SHA256 (clé = service role, jamais
 * exposée) pour empêcher qu'un tiers marque des leads à la place du
 * destinataire réel.
 */
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export const TRACKING_PIXEL_CONTENT_TYPE = "image/gif";

function hmacKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return key;
}

export function signLeadToken(leadId: string): string {
  return createHmac("sha256", hmacKey()).update(leadId).digest("hex");
}

export function verifyLeadToken(leadId: string, signature: string): boolean {
  const expected = Buffer.from(signLeadToken(leadId), "utf8");
  const provided = Buffer.from(signature ?? "", "utf8");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

/**
 * Ajoute le pixel de suivi au bas d'un email HTML. Si l'URL publique de
 * l'app n'est pas configurée (dev sans NEXT_PUBLIC_APP_URL), l'email est
 * renvoyé tel quel pour éviter un pixel cassé.
 */
export function appendOpenTrackingPixel(html: string, leadId: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!baseUrl) return html;
  const pixelUrl = `${baseUrl}/api/leads/track?lead=${encodeURIComponent(leadId)}&sig=${signLeadToken(leadId)}`;
  const img = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;
  return `${html}\n${img}`;
}

export function trackingPixelBody(): ArrayBuffer {
  return new Uint8Array(PIXEL_GIF).buffer as ArrayBuffer;
}
