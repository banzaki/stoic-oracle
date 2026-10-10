import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";

/**
 * Spending guard for the public site.
 *
 * Before any model call, a request reserves its share atomically, in one Redis script:
 * a conservative cost estimate against the global daily budget, and one unit per reply
 * against the visitor's hourly and daily allowances. Concurrent requests therefore cannot
 * overshoot. When the request ends, the estimate is replaced by the cost measured from the
 * real token usage.
 *
 * A "visitor" is a random cookie plus the client address, each counted separately: clearing
 * cookies does not reset the address's allowance, and a shared address (an office, a phone
 * network) gets a larger allowance than one browser. Neither identifies a person reliably;
 * the global budget is the real ceiling, and the Anthropic Console spend limit the last one.
 *
 * On Vercel the counters must live in Redis (Upstash): without it, or if it cannot be
 * reached, every model route refuses to run. Locally they fall back to process memory.
 */

const num = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const LIMITS = {
  /** Global budget per UTC day, in US dollars. */
  dailyBudgetUsd: num(process.env.DAILY_BUDGET_USD, 2),
  /** Philosopher replies per visitor; a Council question counts one per speaker. */
  repliesPerHour: num(process.env.REPLIES_PER_HOUR, 6),
  repliesPerDay: num(process.env.REPLIES_PER_DAY, 10),
  councilsPerDay: num(process.env.COUNCILS_PER_DAY, 2),
  /** Passage translations per visitor (cheap, but not free). */
  translationsPerHour: num(process.env.TRANSLATIONS_PER_HOUR, 20),
  translationsPerDay: num(process.env.TRANSLATIONS_PER_DAY, 60),
  /** An address may be shared by several people, so its allowance is this many visitors'. */
  addressFactor: num(process.env.ADDRESS_FACTOR, 2),
};

// Conservative estimates (US dollars) reserved before a call and settled afterwards.
// A private reply: persona, up to ~24k characters of history, 8 passages, 3000 output tokens,
// plus the retrieval steps (worst case ~$0.062). A Council speaker reads up to three rounds and writes
// at most 1500 tokens (~$0.047). A passage translation
// reads one passage and writes at most 3000 tokens.
const ESTIMATE_USD = { reply: 0.07, councilSpeaker: 0.05, translation: 0.035 };

// US dollars per million tokens: input, output, cache write (5 min), cache read.
const PRICES: Record<string, [number, number, number, number]> = {
  "claude-sonnet-5-5": [2, 10, 2.5, 0.2],
  "claude-haiku-4-5": [1, 5, 1.25, 0.1],
};

/** Cost of one call in micro-dollars (integers keep the Redis arithmetic exact). */
function costMicros(model: string, usage: Anthropic.Usage): number {
  const key = Object.keys(PRICES).find((m) => model.startsWith(m)) ?? "claude-sonnet-5-5";
  const [input, output, cacheWrite, cacheRead] = PRICES[key];
  return Math.ceil(
    usage.input_tokens * input +
      usage.output_tokens * output +
      (usage.cache_creation_input_tokens ?? 0) * cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * cacheRead,
  );
}

// ---------- per-request ledger ----------

/** Measured cost of the model calls made while serving one request. */
interface Ledger {
  micros: number;
}

const ledgers = new AsyncLocalStorage<Ledger>();

/** Adds a model call's cost to the request being served (see `Admission.run`). */
export function recordUsage(model: string, usage: Anthropic.Usage) {
  const ledger = ledgers.getStore();
  if (ledger) ledger.micros += costMicros(model, usage);
}

// ---------- stores ----------

interface Counter {
  key: string;
  inc: number;
  limit: number;
  ttl: number;
}

type ReserveResult = "ok" | "budget" | `limit:${number}`;

interface LimitStore {
  reserve(budgetKey: string, budgetMicros: number, costMicros: number, counters: Counter[]): Promise<ReserveResult>;
  adjust(budgetKey: string, deltaMicros: number): Promise<void>;
  paused(): Promise<boolean>;
}

// Checks everything first and only then writes, so a refused request reserves nothing.
const RESERVE_SCRIPT = `
local spent = tonumber(redis.call('GET', KEYS[1]) or '0')
if spent + tonumber(ARGV[2]) > tonumber(ARGV[1]) then return 'budget' end
for i = 2, #KEYS do
  local base = 4 + (i - 2) * 3
  local used = tonumber(redis.call('GET', KEYS[i]) or '0')
  if used + tonumber(ARGV[base]) > tonumber(ARGV[base + 1]) then return 'limit:' .. (i - 1) end
end
redis.call('INCRBY', KEYS[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
for i = 2, #KEYS do
  local base = 4 + (i - 2) * 3
  redis.call('INCRBY', KEYS[i], ARGV[base])
  redis.call('EXPIRE', KEYS[i], ARGV[base + 2])
end
return 'ok'
`;

const BUDGET_TTL = 3 * 86_400;
const PAUSE_KEY = "oracle:paused";

function redisStore(redis: Redis): LimitStore {
  const script = redis.createScript<string>(RESERVE_SCRIPT);
  return {
    async reserve(budgetKey, budgetMicros, cost, counters) {
      const keys = [budgetKey, ...counters.map((c) => c.key)];
      const args = [budgetMicros, cost, BUDGET_TTL, ...counters.flatMap((c) => [c.inc, c.limit, c.ttl])].map(String);
      return (await script.exec(keys, args)) as ReserveResult;
    },
    async adjust(budgetKey, delta) {
      if (delta) await redis.incrby(budgetKey, delta);
    },
    async paused() {
      return (await redis.get<string>(PAUSE_KEY)) === "1";
    },
  };
}

/** Single-process fallback for local development; JavaScript runs it without interleaving. */
function memoryStore(): LimitStore {
  const values = new Map<string, { value: number; expires: number }>();
  const get = (key: string) => {
    const entry = values.get(key);
    return entry && entry.expires > Date.now() ? entry.value : 0;
  };
  const add = (key: string, inc: number, ttl: number) => {
    values.set(key, { value: get(key) + inc, expires: Date.now() + ttl * 1000 });
    if (values.size > 50_000) values.delete(values.keys().next().value!);
  };
  return {
    async reserve(budgetKey, budgetMicros, cost, counters) {
      if (get(budgetKey) + cost > budgetMicros) return "budget";
      const over = counters.findIndex((c) => get(c.key) + c.inc > c.limit);
      if (over !== -1) return `limit:${over + 1}`;
      add(budgetKey, cost, BUDGET_TTL);
      for (const c of counters) add(c.key, c.inc, c.ttl);
      return "ok";
    },
    async adjust(budgetKey, delta) {
      add(budgetKey, delta, BUDGET_TTL);
    },
    async paused() {
      return false;
    },
  };
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const onVercel = process.env.VERCEL === "1";

const store: LimitStore | null =
  redisUrl && redisToken
    ? redisStore(new Redis({ url: redisUrl, token: redisToken, automaticDeserialization: false }))
    : onVercel
      ? null // never fall back to per-instance memory in production
      : memoryStore();

// ---------- admission ----------

export type LimitCode = "daily_limit" | "visitor_limit" | "council_limit" | "paused" | "unavailable";

export interface Refusal {
  status: number;
  code: LimitCode;
  message: string;
  setCookie?: string;
}

export interface Admission {
  /** Set on the response when the visitor had no id cookie yet. */
  setCookie?: string;
  /** Runs `work` with a ledger that collects the cost of its model calls. */
  run<T>(work: () => T): T;
  /** Replaces the reserved estimate with the measured cost. Call once, when the request ends. */
  settle(): Promise<void>;
}

const MESSAGES: Record<LimitCode, string> = {
  daily_limit: "The oracle has spoken enough for today. Return tomorrow.",
  visitor_limit: "You have asked a great deal for now. Let it settle, and return a little later.",
  council_limit: "The council meets twice a day for each visitor. The philosophers will gladly speak with you one by one.",
  paused: "The oracle is resting for a while. Please return later.",
  unavailable: "The oracle cannot be consulted right now. Please return later.",
};

const COOKIE = "so_vid";
const SALT = process.env.LIMITS_SALT ?? "stoic-oracle";

function hash(value: string): string {
  return createHash("sha256").update(`${SALT}:${value}`).digest("base64url").slice(0, 22);
}

/** The visitor's cookie id (created if missing) and address, both hashed before storage. */
function identify(request: Request): { visitor: string; address: string; setCookie?: string } {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9-]{20,64})`))?.[1];
  const id = cookie ?? randomUUID();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const setCookie = cookie ? undefined : `${COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`;
  // On Vercel the platform sets x-forwarded-for; the first entry is the client.
  const address =
    request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return { visitor: hash(`v:${id}`), address: hash(`a:${address}`), setCookie };
}

function refusal(code: LimitCode, setCookie?: string): Refusal {
  const status = code === "unavailable" || code === "paused" ? 503 : 429;
  return { status, code, message: MESSAGES[code], setCookie };
}

/**
 * Admits a request for model calls, or refuses it. `kind` is a private reply, a Council
 * question with `speakers` replies, or a passage translation.
 */
export async function admit(
  request: Request,
  kind: "reply" | "council" | "translation",
  speakers = 1,
): Promise<Admission | Refusal> {
  const { visitor, address, setCookie } = identify(request);
  if (!store) {
    console.error("usage-limits: no Redis configured on Vercel; refusing model calls");
    return refusal("unavailable", setCookie);
  }
  if (process.env.ORACLE_PAUSED === "1") return refusal("paused", setCookie);

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const hour = now.toISOString().slice(0, 13);
  const budgetKey = `budget:${day}`;
  const factor = LIMITS.addressFactor;
  const H = 3_700;
  const D = 90_000;

  const counters: Counter[] = [];
  const both = (name: string, window: string, inc: number, limit: number, ttl: number) => {
    counters.push({ key: `v:${visitor}:${name}:${window}`, inc, limit, ttl });
    counters.push({ key: `a:${address}:${name}:${window}`, inc, limit: limit * factor, ttl });
  };
  let estimate: number;
  if (kind === "translation") {
    both("tr", hour, 1, LIMITS.translationsPerHour, H);
    both("tr", day, 1, LIMITS.translationsPerDay, D);
    estimate = ESTIMATE_USD.translation;
  } else {
    const replies = kind === "council" ? speakers : 1;
    both("replies", hour, replies, LIMITS.repliesPerHour, H);
    both("replies", day, replies, LIMITS.repliesPerDay, D);
    if (kind === "council") both("council", day, 1, LIMITS.councilsPerDay, D);
    estimate = kind === "council" ? ESTIMATE_USD.councilSpeaker * speakers : ESTIMATE_USD.reply;
  }
  const reserved = Math.ceil(estimate * 1_000_000);

  let result: ReserveResult;
  try {
    if (await store.paused()) return refusal("paused", setCookie);
    result = await store.reserve(budgetKey, Math.round(LIMITS.dailyBudgetUsd * 1_000_000), reserved, counters);
  } catch (error) {
    // If the counters cannot be checked, nothing is spent.
    console.error("usage-limits: store unavailable", error instanceof Error ? error.message : error);
    return refusal("unavailable", setCookie);
  }
  if (result === "budget") return refusal("daily_limit", setCookie);
  if (result !== "ok") {
    const counter = counters[Number(result.split(":")[1]) - 1];
    return refusal(counter?.key.includes(":council:") ? "council_limit" : "visitor_limit", setCookie);
  }

  const ledger: Ledger = { micros: 0 };
  let settled = false;
  return {
    setCookie,
    run: (work) => ledgers.run(ledger, work),
    async settle() {
      if (settled) return;
      settled = true;
      try {
        await store.adjust(budgetKey, ledger.micros - reserved);
      } catch (error) {
        // The estimate stays reserved: the budget errs on the safe side.
        console.error("usage-limits: could not settle", error instanceof Error ? error.message : error);
      }
      console.info(`usage: kind=${kind} reserved=${reserved} actual=${ledger.micros} micro-usd`);
    },
  };
}

export function isRefusal(value: Admission | Refusal): value is Refusal {
  return "code" in value;
}

/** A JSON error response for a refusal, carrying the visitor cookie if one was created. */
export function refusalResponse(r: Refusal): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (r.setCookie) headers.append("Set-Cookie", r.setCookie);
  return new Response(JSON.stringify({ error: { code: r.code, message: r.message } }), { status: r.status, headers });
}
