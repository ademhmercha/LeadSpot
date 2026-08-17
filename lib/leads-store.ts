import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lead } from "./types";
import { recordLeadEvent } from "./lead-events";

/**
 * Établissements trouvés par une recherche (ou un rescan) et prêts à être
 * stockés, avec leur contexte de recherche.
 */
export interface FoundPlaceRow {
  place_id: string;
  name: string;
  category: string;
  address: string | null;
  lat: number;
  lon: number;
  phone: string | null;
  email: string | null;
  siret: string | null;
  website: string | null;
  search_category: string;
  search_zone: string;
  search_radius_km: number;
}

export interface StoreResult {
  leads: Lead[];
  inserted: number;
  merged: number;
}

type LeadLite = Pick<
  Lead,
  | "id"
  | "place_id"
  | "name"
  | "address"
  | "phone"
  | "email"
  | "siret"
  | "website"
>;

/** Minuscules, sans accents, sans ponctuation — pour comparer les noms. */
function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Extrait la ville d'une adresse formatée OSM (« 12 rue X, 69001 Lyon, France » → Lyon). */
function extractCity(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const cityPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  const city = normalizeText(cityPart)
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return city || null;
}

/**
 * Cherche un lead existant qui est probablement le même établissement
 * (même nom + même ville) mais avec un place_id différent — c'est le doublon
 * qu'on fusionne au lieu d'en créer un nouveau.
 */
function findMergeCandidate(
  existingByName: LeadLite[],
  place: FoundPlaceRow,
): LeadLite | null {
  const name = normalizeText(place.name);
  const city = extractCity(place.address);
  for (const lead of existingByName) {
    if (lead.place_id === place.place_id) continue;
    if (normalizeText(lead.name) !== name) continue;
    if (city && extractCity(lead.address) === city) return lead;
    if (!city && normalizeText(lead.address) === normalizeText(place.address))
      return lead;
  }
  return null;
}

/** Découpe une requête `.in()` en lots pour éviter les URL trop longues. */
async function fetchLeadsInChunks(
  admin: SupabaseClient,
  userId: string,
  field: "place_id" | "name",
  values: string[],
  select: string,
): Promise<LeadLite[]> {
  const results: LeadLite[] = [];
  const CHUNK = 100;
  for (let i = 0; i < values.length; i += CHUNK) {
    const { data } = await admin
      .from("leads")
      .select(select)
      .eq("user_id", userId)
      .in(field, values.slice(i, i + CHUNK));
    results.push(...((data ?? []) as unknown as LeadLite[]));
  }
  return results;
}

/**
 * Complète les coordonnées manquantes d'un lead existant avec les données
 * fraîches trouvées par la recherche. Ne touche ni au statut, ni aux notes,
 * ni au contexte de recherche d'origine.
 */
async function mergeMissingFields(
  admin: SupabaseClient,
  userId: string,
  lead: LeadLite,
  place: FoundPlaceRow,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (!lead.phone && place.phone) patch.phone = place.phone;
  if (!lead.email && place.email) patch.email = place.email;
  if (!lead.website && place.website) patch.website = place.website;
  if (!lead.siret && place.siret) patch.siret = place.siret;
  if (Object.keys(patch).length > 0) {
    await admin
      .from("leads")
      .update(patch)
      .eq("id", lead.id)
      .eq("user_id", userId);
  }
}

/**
 * Stocke les établissements trouvés pour un utilisateur en évitant les
 * doublons :
 * - seuls les établissements **contactables** (téléphone OU email) sont
 *   enregistrés — un prospect sans aucun contact ne peut pas être démarché ;
 * - même `place_id` → mise à jour des seules coordonnées manquantes (statut,
 *   notes et zone d'origine conservés) ;
 * - même nom + même ville avec un `place_id` différent → fusion dans le lead
 *   existant (mêmes règles) ;
 * - sinon → insertion d'un nouveau lead.
 * Les événements `created` / `merged` alimentent l'historique de la fiche.
 */
export async function storeFoundPlaces(
  admin: SupabaseClient,
  userId: string,
  places: FoundPlaceRow[],
): Promise<StoreResult> {
  const contactable = places.filter((p) => Boolean(p.phone || p.email));
  if (contactable.length === 0) return { leads: [], inserted: 0, merged: 0 };

  const existingByPlaceId = await fetchLeadsInChunks(
    admin,
    userId,
    "place_id",
    contactable.map((p) => p.place_id),
    "*",
  );
  const byPlaceId = new Map(existingByPlaceId.map((l) => [l.place_id, l]));
  const newPlaces = contactable.filter((p) => !byPlaceId.has(p.place_id));

  // Rafraîchit les coordonnées manquantes des leads déjà connus.
  for (const place of contactable) {
    const existing = byPlaceId.get(place.place_id);
    if (existing) await mergeMissingFields(admin, userId, existing, place);
  }

  const existingByName =
    newPlaces.length > 0
      ? await fetchLeadsInChunks(
          admin,
          userId,
          "name",
          [...new Set(newPlaces.map((p) => p.name))],
          "*",
        )
      : [];

  const toInsert: FoundPlaceRow[] = [];
  let merged = 0;

  for (const place of newPlaces) {
    const candidate = findMergeCandidate(existingByName, place);
    if (!candidate) {
      toInsert.push(place);
      continue;
    }

    await mergeMissingFields(admin, userId, candidate, place);
    await recordLeadEvent(admin, {
      userId,
      leadId: candidate.id,
      type: "merged",
      metadata: { place_id: place.place_id },
    });
    merged += 1;
  }

  const insertedLeads: Lead[] = [];
  if (toInsert.length > 0) {
    const rows = toInsert.map((p) => ({ user_id: userId, ...p }));
    const { data, error } = await admin
      .from("leads")
      .upsert(rows, { onConflict: "user_id,place_id", ignoreDuplicates: false })
      .select();
    if (error) throw error;

    for (const lead of (data ?? []) as Lead[]) {
      await recordLeadEvent(admin, {
        userId,
        leadId: lead.id,
        type: "created",
      });
    }
    insertedLeads.push(...((data ?? []) as Lead[]));
  }

  // Tous les leads contactables présents après cette recherche (existants +
  // insérés) : l'affichage de la zone montre l'ensemble, pas seulement les
  // nouveautés.
  const allLeads = new Map<string, Lead>();
  for (const l of existingByPlaceId as unknown as Lead[]) {
    const place = byPlaceId.get(l.place_id);
    const nowContactable = Boolean(
      l.phone || l.email || place?.phone || place?.email,
    );
    if (nowContactable) allLeads.set(l.id, l);
  }
  for (const l of insertedLeads) allLeads.set(l.id, l);

  return {
    leads: [...allLeads.values()],
    inserted: insertedLeads.length,
    merged,
  };
}
