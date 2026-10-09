import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * The library is in English, so a question asked in another language would match
 * almost nothing in keyword search. Such questions are first rewritten as an
 * English search query by a small, fast model; English questions skip this step.
 */

// Translation only, not conversation: the smallest current model is enough.
const QUERY_MODEL = "claude-haiku-4-5";
const QUERY_TIMEOUT_MS = 8000;

const COMMON_ENGLISH = new Set(
  `the a an and or but i i'm im you your me my it it's is are am was were be been to of in on for with what how why when where
  who should do does did can can't cannot not no this that these those about have has had will would there their they he she
  we our us if so just because`.split(/\s+/),
);

export function looksEnglish(text: string): boolean {
  if (/[^ -~\s‘’“”—–…]/.test(text)) return false; // accents or non-Latin scripts
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  if (words.length < 4) return true;
  const common = words.filter((w) => COMMON_ENGLISH.has(w)).length;
  return common / words.length >= 0.15;
}

const INSTRUCTIONS = `You turn a visitor's message to a Stoic philosopher into an English keyword query for searching 19th-century English translations of Stoic texts.
Translate the meaning into English and add the plain classical words those translators would use for the topic (for example: anger, grief, death, fear, fortune, wealth, poverty, exile, friendship, time, pleasure, duty, providence).
Reply with the query only: 5 to 25 English words, no explanation, no quotation marks.`;

/**
 * Returns an English search query for `text`, or `text` itself if it already looks English
 * or the rewrite fails (retrieval then degrades gracefully instead of failing the chat).
 */
export async function toEnglishQuery(client: Anthropic, text: string, signal?: AbortSignal): Promise<string> {
  if (looksEnglish(text)) return text;
  try {
    const response = await client.messages.create(
      {
        model: QUERY_MODEL,
        max_tokens: 120,
        system: INSTRUCTIONS,
        messages: [{ role: "user", content: text }],
      },
      { signal, timeout: QUERY_TIMEOUT_MS, maxRetries: 1 },
    );
    const query = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join(" ")
      .trim();
    console.info(`search-query: model=${response.model} in=${response.usage.input_tokens} out=${response.usage.output_tokens}`);
    // Keep the original too: names and Latin terms match as they are.
    return query ? `${query}\n${text}` : text;
  } catch (error) {
    if (!signal?.aborted) console.error("search-query rewrite failed; using the original text", error instanceof Error ? error.message : error);
    return text;
  }
}
