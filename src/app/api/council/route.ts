import Anthropic from "@anthropic-ai/sdk";
import type { CouncilEvent, CouncilRequest, CouncilRound } from "@/lib/chat-protocol";
import {
  analyseLatest,
  describeError,
  EFFORT,
  findSources,
  formatPassages,
  languageReminder,
  logUsage,
  MODEL,
} from "@/lib/oracle";
import { SYSTEM_PROMPTS } from "@/lib/personas";
import { getPhilosopher, isPhilosopherId, type PhilosopherId } from "@/lib/philosophers";

// Each speaker gives a short contribution, so the ceiling is lower than in a private conversation.
const MAX_OUTPUT_TOKENS = 1500;
const MAX_ROUNDS_IN_CONTEXT = 3;
const MAX_QUESTION_CHARS = 4000;
const MAX_REPLY_CHARS = 3000;
const PASSAGES_PER_SPEAKER = 6;
/** Speaking order of the first round; later rounds rotate it so no one always speaks first. */
const BASE_ORDER: PhilosopherId[] = ["epictetus", "seneca", "marcus-aurelius"];

export const maxDuration = 300;

const COUNCIL_RULES = `# The Council of the Stoa
This conversation is a fictional gathering, the Council of the Stoa: Epictetus, Seneca and Marcus Aurelius answer one visitor together, taking turns. In life you never all met, but here you hear one another.
- Answer the visitor's latest question in your own voice, with your own convictions, temperament and images.
- If others have already spoken this round, bring what they have not: a different angle, an objection, a harder case, another image or a concrete step. Name them where you disagree or would put it more sharply; where you simply agree, say so in a few words or not at all. Never restate or summarise what they said, never open by praising their answer or by announcing that you will not repeat it — start straight with your own point — and do not take on their manner of speaking.
- If the question is factual or practical, the first to speak makes sure the visitor gets the plain answer, marked as knowledge of the visitor's age; those who follow do not repeat it, but test it, qualify it or say what it means for how to live.
- Respond to what the others think, never to how they quote, cite or translate: the transcript shows their words without their sources, and quotations, citations and translations are not a subject of conversation.
- Speak only for yourself; never write lines for the others.
- 50–130 words. No headings, no lists.
- Your quotation and citation rules still hold, and apply only to your own passages given below: never quote or cite the words of the others.`;

const CITATION_MARKS = /\s*\[(?:ench|disc|gs|frag|med|ep|dial|clem|ben)-[^\]]*\]/g;

function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

function parseRequest(body: unknown): CouncilRequest | null {
  if (!body || typeof body !== "object") return null;
  const { rounds, question } = body as Record<string, unknown>;
  if (typeof question !== "string" || !question.trim() || question.length > MAX_QUESTION_CHARS) return null;
  if (!Array.isArray(rounds)) return null;
  const clean: CouncilRound[] = [];
  for (const r of rounds) {
    if (!r || typeof r !== "object") return null;
    const { question: q, replies } = r as Record<string, unknown>;
    if (typeof q !== "string" || q.length > MAX_QUESTION_CHARS || !Array.isArray(replies)) return null;
    const cleanReplies: CouncilRound["replies"] = [];
    for (const reply of replies) {
      const { speaker, content } = (reply ?? {}) as Record<string, unknown>;
      if (!isPhilosopherId(speaker) || typeof content !== "string") return null;
      cleanReplies.push({ speaker, content: content.slice(0, MAX_REPLY_CHARS) });
    }
    clean.push({ question: q.trim(), replies: cleanReplies });
  }
  return { rounds: clean.slice(-MAX_ROUNDS_IN_CONTEXT), question: question.trim() };
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The council so far as one transcript; citation marks are removed because ids belong to each speaker's own library. */
function transcript(rounds: CouncilRound[]): string {
  const lines = rounds.flatMap((round) => [
    `<visitor>${escapeXml(round.question)}</visitor>`,
    ...round.replies.map(
      (r) => `<speaker name="${getPhilosopher(r.speaker).name}">${escapeXml(r.content.replace(CITATION_MARKS, ""))}</speaker>`,
    ),
  ]);
  return `<council_transcript>\n${lines.join("\n")}\n</council_transcript>`;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError(
      503,
      "missing_api_key",
      "The server has no ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "bad_request", "Request body must be JSON.");
  }
  const council = parseRequest(body);
  if (!council) return jsonError(400, "bad_request", "Invalid council format.");

  const shift = council.rounds.length % BASE_ORDER.length;
  const order = [...BASE_ORDER.slice(shift), ...BASE_ORDER.slice(0, shift)];

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: CouncilEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
        const { query, language } = await analyseLatest(
          client,
          [...council.rounds.map((r) => r.question), council.question],
          request.signal,
        );
        send({ type: "language", code: language });
        const current: CouncilRound = { question: council.question, replies: [] };

        for (const speaker of order) {
          if (request.signal.aborted) break;
          const name = getPhilosopher(speaker).name;
          send({ type: "speaker", speaker });
          const sources = findSources(speaker, query, PASSAGES_PER_SPEAKER);
          send({ type: "sources", speaker, passages: sources });

          const spoken = current.replies.map((r) => getPhilosopher(r.speaker).name);
          const prompt =
            `${transcript([...council.rounds, current])}\n\n${formatPassages(sources)}\n\n` +
            `It is your turn, ${name}. Answer the visitor's latest question` +
            (spoken.length ? `, and respond to what ${spoken.join(" and ")} just said.` : ". You speak first this round.") +
            languageReminder(language);

          try {
            const response = client.messages.stream(
              {
                model: MODEL,
                max_tokens: MAX_OUTPUT_TOKENS,
                // The persona is the cached prefix, shared with private conversations; council rules follow it.
                system: [
                  { type: "text", text: SYSTEM_PROMPTS[speaker], cache_control: { type: "ephemeral" } },
                  { type: "text", text: COUNCIL_RULES },
                ],
                messages: [{ role: "user", content: prompt }],
                output_config: { effort: EFFORT },
              },
              { signal: request.signal },
            );
            let content = "";
            for await (const event of response) {
              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                content += event.delta.text;
                send({ type: "text", speaker, text: event.delta.text });
              }
            }
            const final = await response.finalMessage();
            logUsage(`council[${speaker}]`, final);
            if (final.stop_reason === "refusal") {
              send({ type: "error", speaker, code: "refusal", message: `${name} declined to answer this question.` });
              continue;
            }
            current.replies.push({ speaker, content });
            send({ type: "speaker_done", speaker, truncated: final.stop_reason === "max_tokens" });
          } catch (error) {
            if (request.signal.aborted) break;
            // One silent philosopher should not end the council; the others still speak,
            // unless the failure would hit them too.
            const failure = describeError(error);
            send({ type: "error", speaker, ...failure });
            if (failure.code === "invalid_api_key" || failure.code === "rate_limited") break;
          }
        }
        if (!request.signal.aborted) send({ type: "done" });
      } catch (error) {
        if (!request.signal.aborted) send({ type: "error", ...describeError(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
