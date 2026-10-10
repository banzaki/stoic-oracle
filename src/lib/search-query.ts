import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { recordUsage } from "./usage-limits";

/**
 * The library is in English, so a question asked in another language would match
 * almost nothing in keyword search. Such questions are first rewritten as an
 * English search query by a small, fast model, which also names the visitor's language
 * (used to label and translate the sources). English questions skip this step.
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

const INSTRUCTIONS = `You prepare a visitor's message to a Stoic philosopher for a search of 19th-century English translations of Stoic texts.
You receive the visitor's latest message and, when there is one, their previous message for context.
Answer in exactly two lines:
LANGUAGE: the ISO 639-1 code of the language the visitor is writing in (judge by the latest message; if it is too short to tell, by the previous one). Croatian, Serbian and Bosnian look alike: decide by spelling (Croatian "tko", "točno", "vrijeme", "djeca"; Serbian "ko", "tačno", "vreme", "deca"; Cyrillic is Serbian) and answer hr when nothing in the text decides it
QUERY: an English keyword query of 5 to 25 words that translates the meaning and adds the plain classical words those translators would use for the topic (for example: anger, grief, death, fear, fortune, wealth, poverty, exile, friendship, time, pleasure, duty, providence)`;

export interface QuestionAnalysis {
  /** English text to search the library with. */
  query: string;
  /** ISO 639-1 code of the visitor's language, e.g. "en", "pt", "hr"; "und" if unknown. */
  language: string;
}

/**
 * Analyses the visitor's latest question (`turns[0]`, with `turns[1]` as context).
 * English questions are searched as they are, without a model call. Others get an English
 * query and a language code; if that fails, retrieval degrades gracefully instead of failing the chat.
 */
export async function analyseQuestion(
  client: Anthropic,
  turns: string[],
  signal?: AbortSignal,
): Promise<QuestionAnalysis> {
  const text = turns.join("\n");
  if (looksEnglish(text)) return { query: text, language: "en" };
  try {
    const content = `<latest>\n${turns[0]}\n</latest>` + (turns[1] ? `\n<previous>\n${turns[1]}\n</previous>` : "");
    const response = await client.messages.create(
      {
        model: QUERY_MODEL,
        max_tokens: 160,
        system: INSTRUCTIONS,
        messages: [{ role: "user", content }],
      },
      { signal, timeout: QUERY_TIMEOUT_MS, maxRetries: 1 },
    );
    const output = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("\n");
    recordUsage(response.model, response.usage);
    console.info(`search-query: model=${response.model} in=${response.usage.input_tokens} out=${response.usage.output_tokens}`);
    const language = output.match(/LANGUAGE:\s*([a-z]{2,3})\b/i)?.[1].toLowerCase() ?? "und";
    const query = output.match(/QUERY:\s*(.+)/i)?.[1].trim() ?? "";
    // Keep the original too: names and Latin terms match as they are.
    return { query: query ? `${query}\n${text}` : text, language };
  } catch (error) {
    if (!signal?.aborted) {
      console.error("search-query rewrite failed; using the original text", error instanceof Error ? error.message : error);
    }
    return { query: text, language: "und" };
  }
}
