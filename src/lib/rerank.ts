import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SourcePassage } from "./corpus/types";
import { getPhilosopher, type PhilosopherId } from "./philosophers";
import { recordUsage } from "./usage-limits";

/**
 * Second stage of retrieval. Keyword search (BM25) finds candidates that share words with
 * the question; a small model then reads them against the question and keeps the ones
 * that actually bear on its meaning ("I feel empty" rarely shares words with the passage
 * that answers it). One call covers every speaker; any failure keeps the keyword order.
 */

const RERANK_MODEL = "claude-haiku-4-5";
const RERANK_TIMEOUT_MS = 6000;
const EXCERPT_CHARS = 300;

export const RERANK_ENABLED = process.env.RERANK !== "off";

const INSTRUCTIONS = `You select library passages for Stoic philosophers who are about to answer a visitor.
For each philosopher you get candidate passages from that philosopher's own writings. Choose those most useful for answering the visitor's latest message: passages that speak to its meaning, situation or emotion, not merely ones that share a word with it. Prefer variety over near-duplicates.
Answer with one line per philosopher, in this form and nothing else:
<philosopher key>: id, id, id
Best first. Use only ids given for that philosopher.`;

function excerpt(p: SourcePassage): string {
  const text = p.text.replace(/\s+/g, " ");
  return text.length > EXCERPT_CHARS ? `${text.slice(0, EXCERPT_CHARS)}…` : text;
}

/**
 * Picks up to `limit` passages per philosopher from their keyword-search candidates.
 * `question` is the visitor's latest message (any language), `context` the previous one.
 */
export async function rerankSources(
  client: Anthropic,
  question: string,
  context: string | undefined,
  pools: Partial<Record<PhilosopherId, SourcePassage[]>>,
  limit: number,
  signal?: AbortSignal,
): Promise<Partial<Record<PhilosopherId, SourcePassage[]>>> {
  const entries = Object.entries(pools) as Array<[PhilosopherId, SourcePassage[]]>;
  const fallback = Object.fromEntries(entries.map(([id, pool]) => [id, pool.slice(0, limit)]));
  const needed = entries.some(([, pool]) => pool.length > limit);
  if (!RERANK_ENABLED || !needed) return fallback;

  const blocks = entries.map(
    ([id, pool]) =>
      `<philosopher key="${id}" name="${getPhilosopher(id).name}" choose="${limit}">\n` +
      pool.map((p) => `[${p.id}] ${p.ref}: ${excerpt(p)}`).join("\n") +
      `\n</philosopher>`,
  );
  const content =
    `<latest_message>\n${question}\n</latest_message>\n` +
    (context ? `<previous_message>\n${context}\n</previous_message>\n` : "") +
    blocks.join("\n");

  try {
    const response = await client.messages.create(
      { model: RERANK_MODEL, max_tokens: 300, system: INSTRUCTIONS, messages: [{ role: "user", content }] },
      { signal, timeout: RERANK_TIMEOUT_MS, maxRetries: 0 },
    );
    recordUsage(response.model, response.usage);
    console.info(`rerank: model=${response.model} in=${response.usage.input_tokens} out=${response.usage.output_tokens}`);
    const output = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");

    const chosen: Partial<Record<PhilosopherId, SourcePassage[]>> = {};
    for (const [id, pool] of entries) {
      const line = output.split("\n").find((l) => l.trim().toLowerCase().startsWith(`${id}:`));
      const byId = new Map(pool.map((p) => [p.id, p]));
      const picked = [...new Set(line?.slice(line.indexOf(":") + 1).split(/[,\s]+/).map((s) => s.replace(/[[\]]/g, "")) ?? [])]
        .map((pid) => byId.get(pid))
        .filter((p): p is SourcePassage => Boolean(p));
      // Top up from the keyword order if the model chose fewer than asked (or nothing).
      for (const p of pool) {
        if (picked.length >= limit) break;
        if (!picked.includes(p)) picked.push(p);
      }
      chosen[id] = picked.slice(0, limit);
    }
    return chosen;
  } catch (error) {
    if (!signal?.aborted) console.error("rerank failed; keeping keyword order", error instanceof Error ? error.message : error);
    return fallback;
  }
}
