import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase-server";
import {
  geocodeZone,
  isSocialOnlyOrMissing,
  reverseGeocodeZone,
  searchPlaces,
} from "@/lib/geoapify";
import {
  buildSearchCacheKey,
  getCachedSearch,
  setCachedSearch,
} from "@/lib/redis";
import { tryConsumeSearchQuota } from "@/lib/usage";
import {
  storeFoundPlaces,
  type FoundPlaceRow,
  type StoreResult,
} from "@/lib/leads-store";
import type { GeoapifyPlace } from "@/lib/types";

interface SearchRequestBody {
  category: string;
  zoneQuery?: string; // free-text city/address
  lat?: number;
  lon?: number;
  radiusKm: number;
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = (await req.json()) as SearchRequestBody;
  const { category, zoneQuery, radiusKm } = body;
  let { lat, lon } = body;

  if (
    !category ||
    !radiusKm ||
    (!zoneQuery && (lat === undefined || lon === undefined))
  ) {
    return NextResponse.json(
      { error: "Paramètres de recherche invalides" },
      { status: 400 },
    );
  }
  if (radiusKm <= 0 || radiusKm > 50) {
    return NextResponse.json(
      { error: "Le rayon doit être compris entre 1 et 50 km" },
      { status: 400 },
    );
  }

  // 1. Enforce monthly quota BEFORE spending an API call.
  const { allowed, usage } = await tryConsumeSearchQuota(user.id);
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Quota mensuel atteint (${usage.limit} recherches/mois). Réessayez le mois prochain.`,
        usage,
      },
      { status: 429 },
    );
  }

  // 2. Resolve zone label + coordinates.
  let zoneLabel = zoneQuery ?? "";
  if (zoneQuery && (lat === undefined || lon === undefined)) {
    const geocoded = await geocodeZone(zoneQuery);
    if (!geocoded) {
      return NextResponse.json(
        { error: "Zone géographique introuvable" },
        { status: 404 },
      );
    }
    lat = geocoded.lat;
    lon = geocoded.lon;
    zoneLabel = geocoded.formatted;
  } else if (lat !== undefined && lon !== undefined && !zoneQuery) {
    // "Locate me" search: reverse-geocode the GPS coordinates into a
    // readable label instead of showing raw "lat,lon" to the user.
    zoneLabel =
      (await reverseGeocodeZone(lat, lon)) ??
      `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
  }

  // 3. Cache lookup (7 days) to save Geoapify free-tier quota (3000 req/day).
  const cacheKey = buildSearchCacheKey(category, lat!, lon!, radiusKm);
  let places: GeoapifyPlace[] | null = await getCachedSearch(cacheKey);
  let fromCache = true;

  if (!places) {
    fromCache = false;
    places = await searchPlaces({ category, lat: lat!, lon: lon!, radiusKm });
    await setCachedSearch(cacheKey, places);
  }

  // 4. Filter to establishments with no real website (missing, or
  //    Facebook/Instagram-only).
  const withoutWebsite = places.filter((p) => isSocialOnlyOrMissing(p.website));

  // 5. Stockage avec déduplication (service role — contourne RLS mais
  //    filtré explicitement par user_id). Un établissement déjà présent
  //    (même place_id, ou même nom + même ville) n'est pas dupliqué :
  //    ses coordonnées manquantes sont complétées, son contexte d'origine
  //    conservé.
  const admin = createServiceRoleClient();
  const rows: FoundPlaceRow[] = withoutWebsite.map((p) => ({
    place_id: p.place_id,
    name: p.name,
    category: p.category,
    address: p.address,
    lat: p.lat,
    lon: p.lon,
    phone: p.phone,
    email: p.email,
    siret: p.siret,
    website: p.website,
    search_category: category,
    search_zone: zoneLabel,
    search_radius_km: radiusKm,
  }));

  let storeResult: StoreResult;
  try {
    storeResult = await storeFoundPlaces(admin, user.id, rows);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    leads: storeResult.leads,
    mergedCount: storeResult.merged,
    totalFound: places.length,
    withoutWebsiteCount: withoutWebsite.length,
    fromCache,
    zoneLabel,
    lat,
    lon,
    usage,
  });
}
