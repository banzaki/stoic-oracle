"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatRequest, StreamEvent } from "@/lib/chat-protocol";
import type { SourcePassage } from "@/lib/corpus/types";
import type { Philosopher } from "@/lib/philosophers";
import { Medallion } from "../Medallion";
import { Reply } from "./Reply";

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourcePassage[];
  status: "streaming" | "done" | "error";
  error?: { code: string; message: string };
}

interface ChatRoomProps {
  philosopher: Philosopher;
  opening: { text: string; ref: string };
  suggestions: string[];
}

let nextId = 0;
const newId = () => `t${Date.now().toString(36)}${(nextId++).toString(36)}`;

/** Only exchanges that completed are sent back as history. */
function buildHistory(turns: Turn[], question: string): ChatRequest["messages"] {
  const history: ChatRequest["messages"] = [];
  for (let i = 0; i < turns.length - 1; i++) {
    const [q, a] = [turns[i], turns[i + 1]];
    if (q.role === "user" && a.role === "assistant" && a.status === "done" && a.content.trim()) {
      history.push({ role: "user", content: q.content }, { role: "assistant", content: a.content });
      i++;
    }
  }
  history.push({ role: "user", content: question });
  return history;
}

export function ChatRoom({ philosopher, opening, suggestions }: ChatRoomProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const knownSources = useMemo(() => {
    const map = new Map<string, SourcePassage>();
    for (const t of turns) for (const s of t.sources ?? []) map.set(s.id, s);
    return map;
  }, [turns]);

  const lastLength = turns.at(-1)?.content.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, lastLength]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateTurn = (id: string, patch: (t: Turn) => Partial<Turn>) =>
    setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...patch(t) } : t)));

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    const userTurn: Turn = { id: newId(), role: "user", content: text, status: "done" };
    const replyTurn: Turn = { id: newId(), role: "assistant", content: "", status: "streaming" };
    const messages = buildHistory(turns, text);
    setTurns((all) => [...all, userTurn, replyTurn]);
    setDraft("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ philosopher: "epictetus", messages } satisfies ChatRequest),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => null);
        const error = payload?.error ?? { code: "server_error", message: `Request failed (${res.status}).` };
        updateTurn(replyTurn.id, () => ({ status: "error", error }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "sources") {
            updateTurn(replyTurn.id, () => ({ sources: event.passages }));
          } else if (event.type === "text") {
            updateTurn(replyTurn.id, (t) => ({ content: t.content + event.text }));
          } else if (event.type === "done") {
            finished = true;
            updateTurn(replyTurn.id, () => ({ status: "done" }));
          } else if (event.type === "error") {
            finished = true;
            updateTurn(replyTurn.id, () => ({ status: "error", error: { code: event.code, message: event.message } }));
          }
        }
      }
      if (!finished) {
        updateTurn(replyTurn.id, () => ({
          status: "error",
          error: { code: "interrupted", message: "The connection closed before the reply finished." },
        }));
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Keep whatever was said before the visitor stopped it.
        updateTurn(replyTurn.id, (t) => ({ status: t.content ? "done" : "error", error: t.content ? undefined : { code: "stopped", message: "Stopped." } }));
      } else {
        console.error(err);
        updateTurn(replyTurn.id, () => ({
          status: "error",
          error: { code: "network", message: "Could not reach the server." },
        }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  const empty = turns.length === 0;

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-gold/10 bg-night/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-3">
          <Link href="/" className="text-sm text-dust transition hover:text-gold" aria-label="Back to all philosophers">
            ←
          </Link>
          <Medallion monogram={philosopher.monogram} size={40} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl leading-none text-parchment">{philosopher.name}</h1>
            <p className="mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-dust">
              {philosopher.lifespan} · {philosopher.role}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="rounded-full border border-gold/25 px-3 py-1 text-xs text-stone transition hover:border-gold/60 hover:text-gold-bright"
            aria-expanded={showGuide}
          >
            How to read
          </button>
        </div>
        {showGuide && (
          <div className="mx-auto max-w-3xl px-5 pb-4 text-sm leading-relaxed text-stone">
            <ul className="space-y-1.5 rounded-xl border border-gold/15 bg-umber/80 p-4">
              <li>
                <span className="text-parchment">Plain text</span> is Epictetus as portrayed by an AI — an interpretation
                grounded in his recorded teaching, not his literal words.
              </li>
              <li>
                <span className="border-b border-gold/40 text-gold-bright">Gold quotations ✓</span> were checked
                word-for-word against the translations in the library.
              </li>
              <li>
                <span className="border-b border-dashed border-ember/50 text-parchment">Quotations marked ≈</span> could
                not be found word-for-word — treat them as paraphrase.
              </li>
              <li>
                <span className="text-gold">Numbers</span> link to the full passages, shown under each reply with their
                exact reference.
              </li>
            </ul>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-40 pt-8">
        {empty && (
          <section className="animate-rise flex flex-col items-center pt-6 text-center sm:pt-12">
            <Medallion monogram={philosopher.monogram} size={128} />
            <p className="mt-4 font-serif text-base text-stone">{philosopher.nativeName}</p>
            <blockquote className="mt-10 max-w-xl">
              <p className="font-display text-3xl italic leading-snug text-parchment sm:text-4xl">“{opening.text}”</p>
              <footer className="mt-4 text-xs uppercase tracking-[0.2em] text-dust">{opening.ref}</footer>
            </blockquote>
            <div className="ornament mt-12 w-full max-w-md text-[10px]">◆</div>
            <p className="mt-8 text-sm text-stone">Bring him a question that is troubling you.</p>
            <div className="mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-gold/20 bg-umber/60 px-4 py-2 text-left text-sm text-parchment/85 transition hover:border-gold/50 hover:bg-ash hover:text-parchment"
                >
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}

        <ol className="space-y-10">
          {turns.map((turn) =>
            turn.role === "user" ? (
              <li key={turn.id} className="animate-rise flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm border border-white/5 bg-ash/80 px-5 py-3 text-[0.97rem] leading-relaxed text-parchment/90">
                  {turn.content}
                </p>
              </li>
            ) : (
              <li key={turn.id} className="animate-rise">
                <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-gold/80">
                  <span>{philosopher.name}</span>
                  <span className="text-dust normal-case tracking-normal">· AI portrayal</span>
                </div>
                {turn.status === "streaming" && !turn.content && (
                  <p className="animate-flicker font-serif text-lg italic text-stone">He considers your question…</p>
                )}
                {turn.content && (
                  <Reply
                    replyId={turn.id}
                    text={turn.content}
                    streaming={turn.status === "streaming"}
                    sources={turn.sources ?? []}
                    knownSources={knownSources}
                  />
                )}
                {turn.status === "error" && turn.error && <ErrorNotice error={turn.error} />}
              </li>
            ),
          )}
        </ol>
        <div ref={endRef} />
      </main>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-night via-night/95 to-transparent pb-5 pt-10"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-3 px-5">
          <label htmlFor="question" className="sr-only">
            Your message to {philosopher.name}
          </label>
          <textarea
            id="question"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask(draft);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={`Speak to ${philosopher.name}…`}
            className="field-sizing-content max-h-48 min-h-[3.25rem] flex-1 resize-none rounded-2xl border border-gold/20 bg-umber/95 px-5 py-3.5 font-serif text-lg text-parchment placeholder:text-dust focus:border-gold/50 focus:outline-none"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="h-[3.25rem] rounded-2xl border border-gold/30 px-5 text-sm text-stone transition hover:border-gold hover:text-parchment"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className="h-[3.25rem] rounded-2xl bg-gold px-5 text-sm font-semibold text-night transition hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-30"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function ErrorNotice({ error }: { error: { code: string; message: string } }) {
  if (error.code === "missing_api_key") {
    return (
      <div className="rounded-xl border border-ember/40 bg-ember/5 p-5 text-sm leading-relaxed text-stone">
        <p className="font-display text-xl text-parchment">The oracle is silent.</p>
        <p className="mt-2">No AI provider key is configured on the server, so no reply was generated.</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>
            Create a file named <code className="text-gold-bright">.env.local</code> in the project root.
          </li>
          <li>
            Add <code className="text-gold-bright">ANTHROPIC_API_KEY=your-key</code> (from console.anthropic.com).
          </li>
          <li>Restart the development server and ask again.</li>
        </ol>
      </div>
    );
  }
  return (
    <p className="mt-3 rounded-lg border border-ember/30 bg-ember/5 px-4 py-2 text-sm text-ember">{error.message}</p>
  );
}
