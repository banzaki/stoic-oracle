import "server-only";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Spending guard for a public deployment: a daily budget in dollars, estimated from the
 * real token usage of every model call, and a per-visitor allowance per hour.
 *
 * Counters live in this server process's memory. That is exact on a single server
 * (`npm start`); on serverless hosting each instance keeps its own counters, so a shared
 * store (e.g. Redis) should replace them there. Either way, set a monthly spend limit in
 * the Anthropic Console as the hard ceiling.
 */

/** Daily budget in US dollars (UTC day). Override with DAILY_BUDGET_USD. */
const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD ?? 2);
/** Philosopher replies one visitor may request per hour. A Council question counts once per speaker. */
const REPLIES_PER_VISITOR_HOUR = Number(process.env.REPLIES_PER_VISITOR_HOUR ?? 30);
/** Passage translations one visitor may request per hour (each is cheap, but not free). */
const TRANSLATIONS_PER_VISITOR_HOUR = Number(process.env.TRANSLATIONS_PER_VISITOR_HOUR ?? 120);

// US dollars per million tokens: input, output, cache write (5 min), cache read.
const PRICES: Record<string, [number, number, number, number]> = {
  "claude-sonnet-5-5": [2, 10, 2.5, 0.2],
  "claude-haiku-4-5": [1, 5, 1.25, 0.1],
};

let day = "";
let spentToday = 0;
const visits = new Map<string, number[]>();
const translations = new Map<string, number[]>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function rollDay() {
  const now = today();
  if (now !== day) {
    day = now;
    spentToday = 0;
  }
}

/** Adds the estimated cost of one model call to today's spending. */
export function recordUsage(model: string, usage: Anthropic.Usage) {
  rollDay();
  const prices = PRICES[Object.keys(PRICES).find((m) => model.startsWith(m)) ?? "claude-sonnet-5-5"];
  const [input, output, cacheWrite, cacheRead] = prices;
  spentToday +=
    (usage.input_tokens * input +
      usage.output_tokens * output +
      (usage.cache_creation_input_tokens ?? 0) * cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * cacheRead) /
    1_000_000;
}

/** Best-effort visitor key: the client address as forwarded by the host, or "local". */
export function visitorKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

function take(log: Map<string, number[]>, key: string, units: number, perHour: number): boolean {
  const now = Date.now();
  const recent = (log.get(key) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length + units > perHour) {
    log.set(key, recent);
    return false;
  }
  for (let i = 0; i < units; i++) recent.push(now);
  log.set(key, recent);
  if (log.size > 10_000) log.delete(log.keys().next().value!); // keep memory bounded
  return true;
}

export type LimitRefusal = { status: 429; code: "daily_limit" | "visitor_limit"; message: string };

/**
 * Checks the budget and the visitor's allowance before any model call, and reserves the
 * allowance if the request may go ahead. Returns null when allowed.
 */
export function checkLimits(
  request: Request,
  kind: "reply" | "translation",
  units = 1,
): LimitRefusal | null {
  rollDay();
  if (spentToday >= DAILY_BUDGET_USD) {
    return {
      status: 429,
      code: "daily_limit",
      message: "The oracle has spoken enough for today. Return tomorrow.",
    };
  }
  const allowed =
    kind === "reply"
      ? take(visits, visitorKey(request), units, REPLIES_PER_VISITOR_HOUR)
      : take(translations, visitorKey(request), units, TRANSLATIONS_PER_VISITOR_HOUR);
  if (!allowed) {
    return {
      status: 429,
      code: "visitor_limit",
      message: "You have asked a great deal this hour. Let it settle, and return a little later.",
    };
  }
  return null;
}
