import Anthropic from "@anthropic-ai/sdk";
import { epictetusCorpus, toSourcePassage } from "@/lib/corpus/epictetus";
import type { SourcePassage } from "@/lib/corpus/types";
import { EPICTETUS_SYSTEM_PROMPT } from "@/lib/personas/epictetus";
import { searchPassages } from "@/lib/retrieval";
import type { ChatRequest, StreamEvent } from "@/lib/chat-protocol";

// The API key is read from the server environment only and never sent to the browser.
const MODEL = "claude-sonnet-5-5";
// Conversation rather than deep analysis; "low" is the recommended starting level for chat on this model.
const EFFORT = "low" as const;
// Ceiling on output per reply (thinking included); replies are meant to be short.
const MAX_OUTPUT_TOKENS = 3000;
const PASSAGES_PER_TURN = 8;
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;

export const maxDuration = 120;

function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

function parseRequest(body: unknown): ChatRequest | null {
  if (!body || typeof body !== "object") return null;
  const { philosopher, messages } = body as Record<string, unknown>;
  if (philosopher !== "epictetus" || !Array.isArray(messages) || messages.length === 0) return null;
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
  return { philosopher, messages: clean.slice(-MAX_HISTORY_MESSAGES) };
}

function formatPassages(passages: SourcePassage[]): string {
  const items = passages.map(
    (p) =>
      `<passage id="${p.id}" ref="${p.ref}" translator="${p.translator}"${p.note ? ` note="${p.note}"` : ""}>\n${p.text}\n</passage>`,
  );
  return `<library_passages>\n${items.join("\n")}\n</library_passages>`;
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
  const chat = parseRequest(body);
  if (!chat) return jsonError(400, "bad_request", "Invalid conversation format.");

  // Retrieve passages for the latest question, with the previous question as context for follow-ups.
  const userTurns = chat.messages.filter((m) => m.role === "user").map((m) => m.content);
  const query = userTurns.slice(-2).reverse().join("\n");
  const sources = searchPassages(epictetusCorpus, query, { limit: PASSAGES_PER_TURN }).map(toSourcePassage);

  // Earlier turns are sent as plain text; only the latest turn carries passages.
  const history: Anthropic.MessageParam[] =chat.messages.map((m, i) =>
    i === chat.messages.length - 1
      ? {
          role: "user",
          content: `${formatPassages(sources)}\n\n<visitor_message>\n${m.content}\n</visitor_message>`,
        }
      : { role: m.role, content: m.content },
  );

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      send({ type: "sources", passages: sources });

      try {
        // Model fallbacks are intentionally disabled for now: one model is tested at a time.
        const response = client.messages.stream(
          {
            model: MODEL,
            max_tokens: MAX_OUTPUT_TOKENS,
            // Only the persona is cached: earlier turns are resent without their passages,
            // so the conversation prefix changes every turn and caching it would never be read.
            system: [{ type: "text", text: EPICTETUS_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
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
        console.info(
          `chat: model=${final.model} stop=${final.stop_reason} in=${final.usage.input_tokens}` +
            ` cache_write=${final.usage.cache_creation_input_tokens ?? 0}` +
            ` cache_read=${final.usage.cache_read_input_tokens ?? 0} out=${final.usage.output_tokens}`,
        );
        if (final.stop_reason === "refusal") {
          send({ type: "error", code: "refusal", message: "Epictetus declined to answer this message." });
        } else {
          send({ type: "done", truncated: final.stop_reason === "max_tokens" });
        }
      } catch (error) {
        if (request.signal.aborted) {
          // The visitor closed the page or cancelled; nothing to report.
        } else if (error instanceof Anthropic.AuthenticationError) {
          send({ type: "error", code: "invalid_api_key", message: "The configured API key was rejected." });
        } else if (error instanceof Anthropic.RateLimitError) {
          send({ type: "error", code: "rate_limited", message: "Too many requests right now. Try again shortly." });
        } else if (error instanceof Anthropic.APIError) {
          console.error("Anthropic API error", error.status, error.message);
          send({ type: "error", code: "api_error", message: "The oracle is unavailable right now. Try again." });
        } else {
          console.error("Chat stream failed", error);
          send({ type: "error", code: "server_error", message: "Something went wrong on the server." });
        }
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
