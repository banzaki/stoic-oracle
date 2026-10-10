import Anthropic from "@anthropic-ai/sdk";
import type { ChatRequest, StreamEvent } from "@/lib/chat-protocol";
import {
  describeError,
  EFFORT,
  formatPassages,
  languageReminder,
  logUsage,
  MODEL,
  retrieveSources,
} from "@/lib/oracle";
import { SYSTEM_PROMPTS } from "@/lib/personas";
import { isPhilosopherId } from "@/lib/philosophers";
import { admit, isRefusal, refusalResponse } from "@/lib/usage-limits";

// Ceiling on output per reply (thinking included); replies are meant to be short.
const MAX_OUTPUT_TOKENS = 1800;
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;
// Oldest exchanges are dropped beyond this, which also bounds the cost estimate per reply.
const MAX_HISTORY_CHARS = 12_000;
const MAX_BODY_BYTES = 120_000;

export const maxDuration = 120;

function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

function parseRequest(body: unknown): ChatRequest | null {
  if (!body || typeof body !== "object") return null;
  const { philosopher, messages } = body as Record<string, unknown>;
  if (!isPhilosopherId(philosopher) || !Array.isArray(messages) || messages.length === 0) return null;
  const clean: ChatRequest["messages"] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = content.trim();
    if (!text || text.length > MAX_MESSAGE_CHARS) return null;
    clean.push({ role, content: text });
  }
  if (clean[clean.length - 1].role !== "user") return null;
  const kept = clean.slice(-MAX_HISTORY_MESSAGES);
  while (kept.length > 1 && kept.reduce((n, m) => n + m.content.length, 0) > MAX_HISTORY_CHARS) kept.shift();
  // The history must still open with the visitor.
  while (kept.length > 1 && kept[0].role !== "user") kept.shift();
  return { philosopher, messages: kept };
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError(
      503,
      "missing_api_key",
      "The server has no ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server.",
    );
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return jsonError(413, "too_large", "The conversation is too long to send.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "bad_request", "Request body must be JSON.");
  }
  const chat = parseRequest(body);
  if (!chat) return jsonError(400, "bad_request", "Invalid conversation format.");

  const admission = await admit(request, "reply");
  if (isRefusal(admission)) return refusalResponse(admission);

  const client = new Anthropic();
  const encoder = new TextEncoder();

  // Created inside the admission so the cost of every model call below is measured.
  const stream = admission.run(() => new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
        const userTurns = chat.messages.filter((m) => m.role === "user").map((m) => m.content);
        const { sources, language } = await retrieveSources(client, chat.philosopher, userTurns, request.signal);
        send({ type: "language", code: language });
        send({ type: "sources", passages: sources });

        // Earlier turns are sent as plain text; only the latest turn carries passages.
        const history: Anthropic.MessageParam[] = chat.messages.map((m, i) =>
          i === chat.messages.length - 1
            ? {
                role: "user",
                content:
                  `${formatPassages(sources)}\n\n<visitor_message>\n${m.content}\n</visitor_message>` +
                  languageReminder(language),
              }
            : { role: m.role, content: m.content },
        );

        // Model fallbacks are intentionally disabled for now: one model is tested at a time.
        const response = client.messages.stream(
          {
            model: MODEL,
            max_tokens: MAX_OUTPUT_TOKENS,
            // Only the persona is cached: earlier turns are resent without their passages,
            // so the conversation prefix changes every turn and caching it would never be read.
            system: [{ type: "text", text: SYSTEM_PROMPTS[chat.philosopher], cache_control: { type: "ephemeral" } }],
            messages: history,
            output_config: { effort: EFFORT },
          },
          { signal: request.signal },
        );

        for await (const event of response) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send({ type: "text", text: event.delta.text });
          }
        }

        const final = await response.finalMessage();
        logUsage(`chat[${chat.philosopher}]`, final);
        if (final.stop_reason === "refusal") {
          send({ type: "error", code: "refusal", message: "The philosopher declined to answer this message." });
        } else {
          send({ type: "done", truncated: final.stop_reason === "max_tokens" });
        }
      } catch (error) {
        // A visitor who closed the page or pressed Stop needs no report.
        if (!request.signal.aborted) send({ type: "error", ...describeError(error) });
      } finally {
        await admission.settle();
        try {
          controller.close();
        } catch {
          // Already closed: the visitor went away.
        }
      }
    },
  }));

  const headers = new Headers({ "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" });
  if (admission.setCookie) headers.append("Set-Cookie", admission.setCookie);
  return new Response(stream, { headers });
}
