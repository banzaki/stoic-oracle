/**
 * Emergency switch for the public site, acting on the shared Redis store.
 *
 *   npm run oracle -- status    # paused?, and today's estimated spending
 *   npm run oracle -- pause     # every model route refuses at once (no redeploy needed)
 *   npm run oracle -- resume
 *
 * Reads the Redis credentials from the environment or from .env.vercel-production
 * (created by `vercel env pull .env.vercel-production`).
 */
import { readFileSync } from "node:fs";
import { Redis } from "@upstash/redis";

function loadEnvFile(file: string) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // No such file: rely on the environment.
  }
}

loadEnvFile(".env.vercel-production");

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
if (!url || !token) {
  console.error("No Redis credentials. Run `npx vercel env pull .env.vercel-production` first.");
  process.exit(1);
}
const redis = new Redis({ url, token, automaticDeserialization: false });

async function main() {
  const command = process.argv[2] ?? "status";
  if (command === "pause") await redis.set("oracle:paused", "1");
  else if (command === "resume") await redis.del("oracle:paused");
  else if (command !== "status") {
    console.error(`Unknown command "${command}". Use status, pause or resume.`);
    process.exit(1);
  }
  const paused = (await redis.get<string>("oracle:paused")) === "1";
  const day = new Date().toISOString().slice(0, 10);
  const micros = Number((await redis.get<string>(`budget:${day}`)) ?? 0);
  console.log(`Oracle: ${paused ? "PAUSED (no model calls)" : "open"}`);
  console.log(`Spent today (${day}, UTC, estimate incl. replies in progress): US$${(micros / 1_000_000).toFixed(3)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
