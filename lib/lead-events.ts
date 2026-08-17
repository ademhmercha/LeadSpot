import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadEventType } from "./types";

/**
 * Insère un événement dans l'historique d'un lead. Appelé depuis les routes
 * serveur (avec un client anon + RLS, ou service role pour les contextes
 * publics comme le suivi d'ouverture).
 */
export async function recordLeadEvent(
  client: SupabaseClient,
  opts: {
    userId: string;
    leadId: string;
    type: LeadEventType;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { userId, leadId, type, metadata } = opts;
  await client
    .from("lead_events")
    .insert({ user_id: userId, lead_id: leadId, type, metadata });
}
