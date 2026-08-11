import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { isSocialOnlyOrMissing, searchPlaces } from "@/lib/geoapify";
import { buildSearchCacheKey, getCachedSearch, setCachedSearch } from "@/lib/redis";
import { sendNewLeadsAlertEmail } from "@/lib/resend";
import { sendPushNotification } from "@/lib/webpush";
import { verifyQstashSignature } from "@/lib/qstash-verify";
import type { Lead, SavedZone } from "@/lib/types";

/**
 * Weekly job (triggered by QStash, see lib/qstash.ts) that re-scans every
 * saved zone with alerts enabled, upserts any newly-discovered leads, and
 * emails the owner a summary if new leads were found. Bypasses the monthly
 * per-user search quota (it's a background job on the user's behalf, not an
 * interactive search) but still uses the 7-day Redis cache to limit
 * Geoapify calls.
 */
export async function POST(req: NextRequest) {
  const verified = await verifyQstashSignature(req);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: zones, error: zonesError } = await supabase
    .from("saved_zones")
    .select("*")
    .eq("alerts_enabled", true);

  if (zonesError) {
    return NextResponse.json({ error: zonesError.message }, { status: 500 });
  }

  const results: { zoneId: string; newLeads: number; error?: string }[] = [];

  for (const zone of (zones ?? []) as SavedZone[]) {
    try {
      const cacheKey = buildSearchCacheKey(zone.category, zone.lat, zone.lon, zone.radius_km);
      let places = await getCachedSearch(cacheKey);
      if (!places) {
        places = await searchPlaces({
          category: zone.category,
          lat: zone.lat,
          lon: zone.lon,
          radiusKm: zone.radius_km,
        });
        await setCachedSearch(cacheKey, places);
      }

      const withoutWebsite = places.filter((p) => isSocialOnlyOrMissing(p.website));

      const { data: existingLeads } = await supabase
        .from("leads")
        .select("place_id")
        .eq("user_id", zone.user_id)
        .in(
          "place_id",
          withoutWebsite.map((p) => p.place_id)
        );
      const existingIds = new Set((existingLeads ?? []).map((l) => l.place_id));
      const newPlaces = withoutWebsite.filter((p) => !existingIds.has(p.place_id));

      if (newPlaces.length > 0) {
        const rows = newPlaces.map((p) => ({
          user_id: zone.user_id,
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
          search_category: zone.category,
          search_zone: zone.zone_label,
          search_radius_km: zone.radius_km,
        }));

        const { data: inserted, error: insertError } = await supabase
          .from("leads")
          .upsert(rows, { onConflict: "user_id,place_id", ignoreDuplicates: false })
          .select();
        if (insertError) throw insertError;

        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", zone.user_id)
          .single();

        if (profile?.email) {
          await sendNewLeadsAlertEmail({
            to: profile.email,
            zoneLabel: zone.zone_label,
            category: zone.category,
            leads: (inserted ?? []) as Lead[],
          });
        }

        const { data: subscriptions } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", zone.user_id);

        const expiredEndpoints: string[] = [];
        for (const sub of (subscriptions ?? []) as { endpoint: string; p256dh: string; auth: string }[]) {
          const { expired } = await sendPushNotification(sub, {
            title: `LeadSpot : ${newPlaces.length} nouveau(x) lead(s)`,
            body: `${newPlaces.length} nouvel(s) établissement(s) sans site web trouvé(s) à ${zone.zone_label} (${zone.category}).`,
            url: "/dashboard",
          });
          if (expired) expiredEndpoints.push(sub.endpoint);
        }
        if (expiredEndpoints.length > 0) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", zone.user_id)
            .in("endpoint", expiredEndpoints);
        }
      }

      await supabase.from("saved_zones").update({ last_scanned_at: new Date().toISOString() }).eq("id", zone.id);

      results.push({ zoneId: zone.id, newLeads: newPlaces.length });
    } catch (err) {
      results.push({ zoneId: zone.id, newLeads: 0, error: (err as Error).message });
    }
  }

  return NextResponse.json({ ok: true, scannedZones: results.length, results });
}
