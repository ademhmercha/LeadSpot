import { Client } from "@upstash/qstash";

let client: Client | null = null;

export function getQStash(): Client {
  if (!client) {
    client = new Client({ token: process.env.QSTASH_TOKEN! });
  }
  return client;
}

/**
 * These schedules are created once (manually, via `scripts/setup-qstash.ts`
 * or the Upstash console) so they survive redeploys. Documented here so the
 * cron cadence lives next to the code that implements it:
 *
 *   - POST {APP_URL}/api/cron/rescan   every Monday 06:00 UTC  ("0 6 * * 1")
 *   - POST {APP_URL}/api/keepalive     every 3 days            ("0 5 *\/3 * *")
 */
export const QSTASH_SCHEDULES = {
  rescan: { cron: "0 6 * * 1", path: "/api/cron/rescan" },
  keepalive: { cron: "0 5 */3 * *", path: "/api/keepalive" },
} as const;
