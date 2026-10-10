import Anthropic from "@anthropic-ai/sdk";
import type { CouncilEvent, CouncilRequest, CouncilRound } from "@/lib/chat-protocol";
import {
  analyseLatest,
  describeError,
  EFFORT,
  formatPassages,
  languageReminder,
  logUsage,
  MODEL,
  selectSources,
} from "@/lib/oracle";
import { SYSTEM_PROMPTS } from "@/lib/personas";
import { getPhilosopher, isPhilosopherId, type PhilosopherId } from "@/lib/philosophers";
import { checkLimits } from "@/lib/usage-limits";

// Each speaker gives a short contribution, so the ceiling is lower than in a private conversation.
const MAX_OUTPUT_TOKENS = 1500;
const MAX_ROUNDS_IN_CONTEXT = 3;
const MAX_QUESTION_CHARS = 4000;
const MAX_REPLY_CHARS = 3000;
const PASSAGES_PER_SPEAKER = 6;
/** Speaking order when the request names none. */
const DEFAULT_ORDER: PhilosopherId[] = ["epictetus", "seneca", "marcus-aurelius"];

export const maxDuration = 300;

function joinNames(names: string[]): string {
  return names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** Rules for one speaker in the council; they follow the cached persona as a second system block. */
function councilRules(speaker: PhilosopherId, order: PhilosopherId[]): string {
  const self = getPhilosopher(speaker).name;
  const others = order.filter((id) => id !== speaker).map((id) => getPhilosopher(id).name);
  return `# The Council of the Stoa
This conversation is a fictional gathering, the Council of the Stoa, where ${joinNames(order.map((id) => getPhilosopher(id).name))} answer one visitor, taking turns. You are ${self}; the others present are ${joinNames(others)}. In life you never all met, but here you hear one another.
- Answer the visitor in your own voice, from your own convictions, works and experience, as you genuinely would.
- Agree when you agree, disagree when you disagree, and add something when you have something new to add. A council where nobody disagrees is perfectly fine; never invent an objection to seem different, and never hide a real one to seem agreeable. Where you differ, the difference should come from what you actually hold and lived, and you should say why.
- You may build on another's point, ask one of them a question, or grant that one of them put something well — when it comes naturally, briefly, and not as a ritual. You need not mention the others at all. Begin with your own thought, not with the previous speaker: no opening verdict on what they said ("X put it well", "Both have marked the line", "I would only add…"). If you connect to someone, do it later and in substance. Avoid stock phrases such as "I disagree with…", "Both are right" or "I will not repeat…", and do not restate or summarise what was said.
- If the question is factual or practical, whoever speaks first makes sure the visitor gets the plain answer, marked as knowledge of the visitor's age; those who follow do not repeat it.
- Respond to what the others think, never to how they quote, cite or translate: quotations, citations and translations are not a subject of conversation.
- Speak only for yourself, never write lines for the others, and never address yourself by your own name: in the transcript, lines marked "(you)" are yours.
- 50–130 words. No headings, no lists.
- Your quotation and citation rules still hold, and apply only to your own passages given below: never quote or cite the words of the others.`;
}

const CITATION_MARKS = /\s*\[(?:ench|disc|gs|frag|med|ep|dial|clem|ben)-[^\]]*\]/g;

function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

function parseRequest(body: unknown): CouncilRequest | null {
  if (!body || typeof body !== "object") return null;
  const { rounds, question, speakers } = body as Record<string, unknown>;
  if (typeof question !== "string" || !question.trim() || question.length > MAX_QUESTION_CHARS) return null;
  // Two or three distinct philosophers, in speaking order.
  const order = speakers === undefined ? DEFAULT_ORDER : speakers;
  if (!Array.isArray(order) || order.length < 2 || order.length > 3 || !order.every(isPhilosopherId)) return null;
  if (new Set(order).size !== order.length) return null;
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
  return { rounds: clean.slice(-MAX_ROUNDS_IN_CONTEXT), question: question.trim(), speakers: order };
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The council so far as one transcript, as seen by `reader`: their own lines are marked "(you)".
 * Citation marks are removed because ids belong to each speaker's own library.
 */
function transcript(rounds: CouncilRound[], reader: PhilosopherId): string {
  const lines = rounds.flatMap((round) => [
    `<visitor>${escapeXml(round.question)}</visitor>`,
    ...round.replies.map((r) => {
      const name = getPhilosopher(r.speaker).name + (r.speaker === reader ? " (you)" : "");
      return `<speaker name="${name}">${escapeXml(r.content.replace(CITATION_MARKS, ""))}</speaker>`;
    }),
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

  // The visitor's chosen lineup, in their chosen order.
  const order = council.speakers ?? DEFAULT_ORDER;

  const refusal = checkLimits(request, "reply", order.length);
  if (refusal) return jsonError(refusal.status, refusal.code, refusal.message);

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: CouncilEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
        const questions = [...council.rounds.map((r) => r.question), council.question];
        const { query, language } = await analyseLatest(client, questions, request.signal);
        send({ type: "language", code: language });
        // One re-ranking call chooses every speaker's passages before anyone speaks.
        const chosen = await selectSources(client, order, query, questions, PASSAGES_PER_SPEAKER, request.signal);
        const current: CouncilRound = { question: council.question, replies: [] };

        for (const speaker of order) {
          if (request.signal.aborted) break;
          const name = getPhilosopher(speaker).name;
          send({ type: "speaker", speaker });
          const sources = chosen[speaker] ?? [];
          send({ type: "sources", speaker, passages: sources });

          const spoken = current.replies.map((r) => getPhilosopher(r.speaker).name);
          const prompt =
            `${transcript([...council.rounds, current], speaker)}\n\n${formatPassages(sources)}\n\n` +
            `It is your turn, ${name}. Answer the visitor's latest question` +
            (spoken.length ? ` (${joinNames(spoken)} spoke before you this round).` : ". You speak first this round.") +
            languageReminder(language);

          try {
            const response = client.messages.stream(
              {
                model: MODEL,
                max_tokens: MAX_OUTPUT_TOKENS,
                // The persona is the cached prefix, shared with private conversations; council rules follow it.
                system: [
                  { type: "text", text: SYSTEM_PROMPTS[speaker], cache_control: { type: "ephemeral" } },
                  { type: "text", text: councilRules(speaker, order) },
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
