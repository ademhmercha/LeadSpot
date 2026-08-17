import type { GeoapifyPlace } from "./types";

const PLACES_URL = "https://api.geoapify.com/v2/places";
const GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search";
const REVERSE_GEOCODE_URL = "https://api.geoapify.com/v1/geocode/reverse";

/**
 * A website is considered "not a real website" for prospection purposes if
 * it's missing entirely, or if the only link on file is a Facebook/Instagram
 * page rather than an owned domain.
 */
const SOCIAL_ONLY_DOMAIN_RE =
  /^(https?:\/\/)?(www\.)?(facebook\.com|instagram\.com|m\.facebook\.com|business\.facebook\.com)\//i;

export function isSocialOnlyOrMissing(
  website: string | null | undefined,
): boolean {
  if (!website || website.trim() === "") return true;
  return SOCIAL_ONLY_DOMAIN_RE.test(website.trim());
}

/**
 * Curated subset of Geoapify's "categories" taxonomy for the establishment
 * types freelancers/agencies typically prospect. Full list:
 * https://apidocs.geoapify.com/docs/places/#categories
 */
export const BUSINESS_CATEGORIES: { value: string; label: string }[] = [
  { value: "catering.restaurant", label: "Restaurants" },
  { value: "catering.cafe", label: "Cafés" },
  { value: "catering.bar", label: "Bars" },
  { value: "catering.fast_food", label: "Restauration rapide" },
  { value: "service.beauty.hairdresser", label: "Salons de coiffure" },
  { value: "service.beauty.spa", label: "Instituts de beauté / Spas" },
  { value: "service.beauty", label: "Instituts de beauté (autres)" },
  { value: "commercial.food_and_drink.bakery", label: "Boulangeries" },
  { value: "commercial.food_and_drink.butcher", label: "Boucheries" },
  { value: "commercial.florist", label: "Fleuristes" },
  { value: "service.vehicle.repair", label: "Garages automobiles" },
  {
    value: "commercial.gift_and_souvenir",
    label: "Boutiques cadeaux/souvenirs",
  },
  { value: "commercial.clothing", label: "Boutiques de vêtements" },
  { value: "healthcare.dentist", label: "Cabinets dentaires" },
  { value: "healthcare.clinic_or_praxis", label: "Cabinets médicaux" },
  { value: "sport.fitness", label: "Salles de sport" },
  { value: "accommodation.hotel", label: "Hôtels" },
];

interface GeocodeResult {
  lat: number;
  lon: number;
  formatted: string;
}

/** Geocode a free-text place (city, address) to coordinates via Geoapify. */
export async function geocodeZone(
  query: string,
): Promise<GeocodeResult | null> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) throw new Error("GEOAPIFY_API_KEY is not set");

  const url = new URL(GEOCODE_URL);
  url.searchParams.set("text", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(
      `Geoapify geocoding failed: ${res.status} ${res.statusText}`,
    );
  }
  const data = await res.json();
  const feature = data?.features?.[0];
  if (!feature) return null;

  const [lon, lat] = feature.geometry.coordinates;
  return { lat, lon, formatted: feature.properties.formatted as string };
}

/**
 * Reverse-geocode coordinates (e.g. from the browser's "locate me" button)
 * into a human-readable label, so a GPS-based search still gets a nice
 * `search_zone` value instead of raw "lat,lon".
 */
export async function reverseGeocodeZone(
  lat: number,
  lon: number,
): Promise<string | null> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) throw new Error("GEOAPIFY_API_KEY is not set");

  const url = new URL(REVERSE_GEOCODE_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = await res.json();
  const feature = data?.features?.[0];
  return (feature?.properties?.formatted as string | undefined) ?? null;
}

interface SearchPlacesArgs {
  category: string;
  lat: number;
  lon: number;
  radiusKm: number;
  limit?: number;
}

function extractWebsite(props: Record<string, unknown>): string | null {
  const candidates = [
    props.website,
    (props.contact as Record<string, unknown> | undefined)?.website,
    (props.datasource as { raw?: Record<string, unknown> } | undefined)?.raw
      ?.website,
    (props.datasource as { raw?: Record<string, unknown> } | undefined)?.raw?.[
      "contact:website"
    ],
  ];
  const found = candidates.find(
    (c) => typeof c === "string" && c.trim() !== "",
  );
  return (found as string | undefined) ?? null;
}

function extractPhone(props: Record<string, unknown>): string | null {
  const candidates = [
    props.phone,
    (props.contact as Record<string, unknown> | undefined)?.phone,
    (props.datasource as { raw?: Record<string, unknown> } | undefined)?.raw
      ?.phone,
  ];
  const found = candidates.find(
    (c) => typeof c === "string" && c.trim() !== "",
  );
  return (found as string | undefined) ?? null;
}

function extractEmail(props: Record<string, unknown>): string | null {
  const candidates = [
    props.email,
    (props.contact as Record<string, unknown> | undefined)?.email,
    (props.datasource as { raw?: Record<string, unknown> } | undefined)?.raw
      ?.email,
    (props.datasource as { raw?: Record<string, unknown> } | undefined)?.raw?.[
      "contact:email"
    ],
  ];
  const found = candidates.find(
    (c) => typeof c === "string" && c.trim() !== "",
  );
  return (found as string | undefined) ?? null;
}

/**
 * French businesses are sometimes tagged in OpenStreetMap with their SIRET
 * (official business registration number). When present, it links to the
 * free government "Annuaire des Entreprises" — a useful legitimacy check
 * that has nothing to do with Google Places.
 */
function extractSiret(props: Record<string, unknown>): string | null {
  const raw = (
    props.datasource as { raw?: Record<string, unknown> } | undefined
  )?.raw;
  const siret = raw?.["ref:FR:SIRET"];
  return typeof siret === "string" || typeof siret === "number"
    ? String(siret)
    : null;
}

/**
 * Query Geoapify Places API for establishments of `category` within
 * `radiusKm` of (lat, lon). Returns *all* results — filtering for
 * missing/social-only websites happens in the caller so raw results can
 * still be cached as-is.
 */
export async function searchPlaces({
  category,
  lat,
  lon,
  radiusKm,
  limit = 500,
}: SearchPlacesArgs): Promise<GeoapifyPlace[]> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) throw new Error("GEOAPIFY_API_KEY is not set");

  const url = new URL(PLACES_URL);
  url.searchParams.set("categories", category);
  url.searchParams.set("filter", `circle:${lon},${lat},${radiusKm * 1000}`);
  url.searchParams.set("bias", `proximity:${lon},${lat}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Geoapify places request failed: ${res.status} ${res.statusText} ${body}`,
    );
  }
  const data = await res.json();
  const features: unknown[] = data?.features ?? [];

  return features
    .map((f): GeoapifyPlace | null => {
      const feature = f as { properties: Record<string, unknown> };
      const props = feature.properties;

      // Sans nom, un lieu n'est pas un établissement : c'est une adresse ou une
      // rue. On ne le traite pas comme un lead (sinon « Rue de la République »
      // s'affiche à la place d'un vrai commerce).
      const name = (props.name as string | undefined)?.trim();
      if (!name) return null;

      // Vérifie que l'établissement appartient bien à la catégorie cherchée
      // (accepte un parent ou un enfant de la catégorie) pour exclure les
      // rues/tronçons qui remonteraient dans les résultats.
      const cats = props.categories;
      if (Array.isArray(cats) && cats.length > 0) {
        const matches = (cats as unknown[]).some((c) => {
          if (typeof c !== "string") return false;
          return (
            c === category ||
            c.startsWith(`${category}.`) ||
            category.startsWith(`${c}.`)
          );
        });
        if (!matches) return null;
      }

      return {
        place_id: String(props.place_id),
        name,
        category,
        address: (props.formatted as string) ?? null,
        lat: props.lat as number,
        lon: props.lon as number,
        phone: extractPhone(props),
        email: extractEmail(props),
        siret: extractSiret(props),
        website: extractWebsite(props),
      } satisfies GeoapifyPlace;
    })
    .filter((p): p is GeoapifyPlace => p !== null);
}
