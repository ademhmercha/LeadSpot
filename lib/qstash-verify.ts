import { Receiver } from "@upstash/qstash";
import type { NextRequest } from "next/server";

/**
 * Verifies that a request to a cron-triggered route (/api/keepalive,
 * /api/cron/rescan) genuinely came from QStash, using the Upstash signing
 * keys (Upstash console → QStash → "Signing Keys", free tier).
 *
 * If QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY aren't configured
 * (e.g. local dev), verification is skipped so the routes stay easy to
 * curl/test manually — do NOT leave them unset in production.
 */
export async function verifyQstashSignature(
  req: NextRequest,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentSigningKey || !nextSigningKey) {
    return { ok: true };
  }

  const signature = req.headers.get("upstash-signature");
  if (!signature) {
    return { ok: false, error: "Signature QStash manquante" };
  }

  const receiver = new Receiver({ currentSigningKey, nextSigningKey });
  const body = await req.clone().text();

  try {
    const valid = await receiver.verify({ signature, body });
    if (!valid) return { ok: false, error: "Signature QStash invalide" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Échec de vérification de la signature QStash" };
  }
}
