import Anthropic from "@anthropic-ai/sdk";
import { findPassage, toSourcePassage } from "@/lib/corpus";
import { describeError, EFFORT, MODEL } from "@/lib/oracle";
import { getPhilosopher } from "@/lib/philosophers";
import { findQuoteSource } from "@/lib/quotes";
import { admit, isRefusal, recordUsage, refusalResponse } from "@/lib/usage-limits";

/**
 * Translates one library passage into the visitor's language, on demand: the browser asks
 * only when the visitor opens a reply's references. With `excerpt`, only that part of the
 * passage is translated (a quotation the philosopher left in English); the excerpt must be
 * found word for word in the passage first. The passage text is read from the
 * corpus by id, never taken from the request, and the result is always labelled in the
 * interface as an AI translation of the English edition.
 */

// The conversation model: the passages are shown as the philosopher's words, so fidelity matters
// more than the small saving of a lighter model (which mistook archaic words in testing).
const MAX_OUTPUT_TOKENS = 3000;
const MAX_EXCERPT_CHARS = 600;
const CACHE_LIMIT = 1000;

// Passages are fixed texts, so a translation can be reused for every visitor.
const cache = new Map<string, string>();

function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

function languageName(code: string): string | null {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "language" }).of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError(503, "missing_api_key", "The server has no ANTHROPIC_API_KEY.");
  }

  const body = (await request.json().catch(() => null)) as { id?: unknown; language?: unknown; excerpt?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const excerpt = typeof body?.excerpt === "string" ? body.excerpt.trim() : "";
  const language = typeof body?.language === "string" ? body.language.toLowerCase() : "";
  const found = findPassage(id);
  const name = /^[a-z]{2,3}$/.test(language) && language !== "en" ? languageName(language) : null;
  if (!found || !name) return jsonError(400, "bad_request", "Unknown passage or language.");
  if (excerpt && (excerpt.length > MAX_EXCERPT_CHARS || !findQuoteSource(excerpt, [found.passage]))) {
    return jsonError(400, "bad_request", "The excerpt is not part of that passage.");
  }

  const key = `${language}:${id}${excerpt ? `:${excerpt}` : ""}`;
  const cached = cache.get(key);
  if (cached) return Response.json({ translation: cached });

  const admission = await admit(request, "translation");
  if (isRefusal(admission)) return refusalResponse(admission);

  const passage = toSourcePassage(found.passage);
  const withCookie = (response: Response) => {
    if (admission.setCookie) response.headers.append("Set-Cookie", admission.setCookie);
    return response;
  };
  try {
    const response = await admission.run(() => new Anthropic().messages.create(
      {
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        output_config: { effort: EFFORT },
        system:
          `You translate passages of ${getPhilosopher(found.author).name} from ${passage.translator}'s English translation into ${name}. ` +
          `Read the English with the meanings its words had in the 19th and early 20th centuries ("reviles" means insults, "perturbation" means emotional disturbance). ` +
          `Translate faithfully and completely, keeping the tone, imagery and paragraph breaks, in natural ${name}. ` +
          `Keep square-bracketed insertions in brackets. Do not add notes, titles or explanations. Reply with the translation only.` +
          (excerpt ? ` You are given the whole passage for context, but translate only the excerpt, as a short quotation without quotation marks.` : ""),
        messages: [
          {
            role: "user",
            content: excerpt ? `<passage>
${passage.text}
</passage>
<excerpt>
${excerpt}
</excerpt>` : passage.text,
          },
        ],
      },
      { signal: request.signal },
    ));
    const translation = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    admission.run(() => recordUsage(response.model, response.usage));
    console.info(`translate[${language}:${id}]: model=${response.model} in=${response.usage.input_tokens} out=${response.usage.output_tokens}`);
    if (!translation || response.stop_reason === "max_tokens") {
      return withCookie(jsonError(502, "translation_failed", "The translation could not be completed."));
    }
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(key, translation);
    return withCookie(Response.json({ translation }));
  } catch (error) {
    const { code, message } = describeError(error);
    return withCookie(jsonError(502, code, message));
  } finally {
    await admission.settle();
  }
}
