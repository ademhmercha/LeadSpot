/**
 * One-off setup script: registers the two recurring QStash schedules
 * LeadSpot relies on (weekly rescan + keepalive ping). Run once per
 * environment after deploying, whenever the destination URL changes, or
 * after an accidental deletion in the Upstash console.
 *
 * Usage:
 *   QSTASH_TOKEN=... NEXT_PUBLIC_APP_URL=https://your-app.vercel.app \
 *     npx tsx scripts/setup-qstash.ts
 */
import { Client } from "@upstash/qstash";
import { QSTASH_SCHEDULES } from "../lib/qstash";

async function main() {
  const token = process.env.QSTASH_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!token) throw new Error("QSTASH_TOKEN is not set");
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not set");

  const client = new Client({ token });

  for (const [name, { cron, path }] of Object.entries(QSTASH_SCHEDULES)) {
    const destination = `${appUrl.replace(/\/$/, "")}${path}`;
    const schedule = await client.schedules.create({ destination, cron });
    console.log(`Scheduled "${name}" -> ${destination} (${cron}) — id: ${schedule.scheduleId}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
