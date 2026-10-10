import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { CORPORA, toSourcePassage } from "./corpus";
import type { SourcePassage } from "./corpus/types";
import type { PhilosopherId } from "./philosophers";
import { searchPassages } from "./retrieval";
import { analyseQuestion, type QuestionAnalysis } from "./search-query";

// The API key is read from the server environment only and never sent to the browser.
export const MODEL = "claude-sonnet-5-5";
// Conversation rather than deep analysis; "low" is the recommended starting level for chat on this model.
export const EFFORT = "low" as const;
export const PASSAGES_PER_TURN = 8;

/**
 * The search query and language for the latest question, with the previous question as context
 * for follow-ups. Questions in other languages are rewritten into English first, since the library is in English.
 */
export function analyseLatest(client: Anthropic, userTurns: string[], signal?: AbortSignal): Promise<QuestionAnalysis> {
  return analyseQuestion(client, userTurns.slice(-2).reverse(), signal);
}

export function findSources(philosopher: PhilosopherId, query: string, limit = PASSAGES_PER_TURN): SourcePassage[] {
  return searchPassages(CORPORA[philosopher], query, { limit }).map(toSourcePassage);
}

export async function retrieveSources(
  client: Anthropic,
  philosopher: PhilosopherId,
  userTurns: string[],
  signal?: AbortSignal,
): Promise<{ sources: SourcePassage[]; language: string }> {
  const { query, language } = await analyseLatest(client, userTurns, signal);
  return { sources: findSources(philosopher, query), language };
}

/**
 * A per-turn reminder for conversations in another language. It travels with the visitor's
 * message rather than in the system prompt, so the cached persona prefix stays unchanged.
 */
export function languageReminder(language: string): string {
  if (!/^[a-z]{2,3}$/.test(language) || language === "en") return "";
  let name: string | undefined;
  try {
    name = new Intl.DisplayNames(["en"], { type: "language" }).of(language);
  } catch {
    return "";
  }
  if (!name || name === language) return "";
  return (
    `\n\n<reply_language>${name}</reply_language>\n` +
    `Reply in ${name}. Every quotation must be your own ${name} translation inside the quotation marks, followed by the ` +
    `exact English words after the bar inside its citation, like "${name} translation" [id | exact English words]. ` +
    `Never put the English itself inside the quotation marks or anywhere in your prose, however archaic or beautiful it is.`
  );
}

export function formatPassages(passages: SourcePassage[]): string {
  const items = passages.map(
    (p) =>
      `<passage id="${p.id}" ref="${p.ref}" translator="${p.translator}"${p.note ? ` note="${p.note}"` : ""}>\n${p.text}\n</passage>`,
  );
  return `<library_passages>\n${items.join("\n")}\n</library_passages>`;
}

/** Maps SDK errors to the codes the browser understands; logs the rest. */
export function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof Anthropic.AuthenticationError) {
    return { code: "invalid_api_key", message: "The configured API key was rejected." };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { code: "rate_limited", message: "Too many requests right now. Try again shortly." };
  }
  if (error instanceof Anthropic.APIError) {
    console.error("Anthropic API error", error.status, error.message);
    return { code: "api_error", message: "The oracle is unavailable right now. Try again." };
  }
  console.error("Chat stream failed", error);
  return { code: "server_error", message: "Something went wrong on the server." };
}

export function logUsage(label: string, message: Anthropic.Message) {
  const u = message.usage;
  console.info(
    `${label}: model=${message.model} stop=${message.stop_reason} in=${u.input_tokens}` +
      ` cache_write=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens}`,
  );
}
