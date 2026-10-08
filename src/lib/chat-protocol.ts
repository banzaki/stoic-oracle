import type { SourcePassage } from "./corpus/types";

export interface ChatRequest {
  philosopher: "epictetus";
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

/** Newline-delimited JSON events streamed from /api/chat. */
export type StreamEvent =
  | { type: "sources"; passages: SourcePassage[] }
  | { type: "text"; text: string }
  | { type: "done"; truncated: boolean }
  | { type: "error"; code: string; message: string };
