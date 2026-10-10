import type { SourcePassage } from "./corpus/types";
import type { PhilosopherId } from "./philosophers";

export interface ChatRequest {
  philosopher: PhilosopherId;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface CouncilRound {
  question: string;
  replies: Array<{ speaker: PhilosopherId; content: string }>;
}

export interface CouncilRequest {
  /** Earlier, completed rounds of this council. */
  rounds: CouncilRound[];
  question: string;
}

/** Newline-delimited JSON events streamed from /api/council: each philosopher speaks in turn. */
export type CouncilEvent =
  /** ISO 639-1 code of the visitor's language ("und" if unknown), sent before anyone speaks. */
  | { type: "language"; code: string }
  | { type: "speaker"; speaker: PhilosopherId }
  | { type: "sources"; speaker: PhilosopherId; passages: SourcePassage[] }
  | { type: "text"; speaker: PhilosopherId; text: string }
  | { type: "speaker_done"; speaker: PhilosopherId; truncated: boolean }
  | { type: "error"; speaker?: PhilosopherId; code: string; message: string }
  | { type: "done" };

/** Newline-delimited JSON events streamed from /api/chat. */
export type StreamEvent =
  /** ISO 639-1 code of the visitor's language ("und" if unknown), sent before the sources. */
  | { type: "language"; code: string }
  | { type: "sources"; passages: SourcePassage[] }
  | { type: "text"; text: string }
  | { type: "done"; truncated: boolean }
  | { type: "error"; code: string; message: string };
