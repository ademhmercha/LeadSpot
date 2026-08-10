import { Redis } from "@upstash/redis";
import type { GeoapifyPlace } from "./types";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return client;
}

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** Round coordinates so nearby, near-identical searches share a cache entry. */
function roundCoord(n: number): string {
  return n.toFixed(3);
}

export function buildSearchCacheKey(category: string, lat: number, lon: number, radiusKm: number): string {
  return `leadspot:search:${category}:${roundCoord(lat)}:${roundCoord(lon)}:${radiusKm}`;
}

export async function getCachedSearch(key: string): Promise<GeoapifyPlace[] | null> {
  const redis = getRedis();
  const cached = await redis.get<GeoapifyPlace[]>(key);
  return cached ?? null;
}

export async function setCachedSearch(key: string, places: GeoapifyPlace[]): Promise<void> {
  const redis = getRedis();
  await redis.set(key, places, { ex: CACHE_TTL_SECONDS });
}
