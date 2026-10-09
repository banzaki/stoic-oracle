"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatRequest, StreamEvent } from "@/lib/chat-protocol";
import type { SourcePassage } from "@/lib/corpus/types";
import type { Philosopher } from "@/lib/philosophers";
import { LaurelDivider } from "../Laurel";
import { Portrait } from "../Portrait";
import { Composer } from "./Composer";
import { ErrorNotice } from "./ErrorNotice";
import { readEvents } from "./read-events";
import { ReadingGuide } from "./ReadingGuide";
import { Reply } from "./Reply";

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourcePassage[];
  status: "streaming" | "done" | "error";
  error?: { code: string; message: string };
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

export function ChatRoom({ philosopher }: { philosopher: Philosopher }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const knownSources = useMemo(() => {
    const map = new Map<string, SourcePassage>();
    for (const t of turns) for (const s of t.sources ?? []) map.set(s.id, s);
    return map;
  }, [turns]);

  const lastLength = turns.at(-1)?.content.length ?? 0;
  useEffect(() => {
    // Nothing to follow before the first message; scrolling would hide the opening.
    if (turns.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, lastLength]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateTurn = (id: string, patch: (t: Turn) => Partial<Turn>) =>
    setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...patch(t) } : t)));

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return false;

    const userTurn: Turn = { id: newId(), role: "user", content: text, status: "done" };
    const replyTurn: Turn = { id: newId(), role: "assistant", content: "", status: "streaming" };
    const messages = buildHistory(turns, text);
    setTurns((all) => [...all, userTurn, replyTurn]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ philosopher: philosopher.id, messages } satisfies ChatRequest),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => null);
        const error = payload?.error ?? { code: "server_error", message: `Request failed (${res.status}).` };
        updateTurn(replyTurn.id, () => ({ status: "error", error }));
        return true;
      }

      let finished = false;
      for await (const event of readEvents<StreamEvent>(res.body)) {
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
      if (!finished) {
        updateTurn(replyTurn.id, () => ({
          status: "error",
          error: { code: "interrupted", message: "The connection closed before the reply finished." },
        }));
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Keep whatever was said before the visitor stopped it.
        updateTurn(replyTurn.id, (t) => ({
          status: t.content ? "done" : "error",
          error: t.content ? undefined : { code: "stopped", message: "Stopped." },
        }));
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
    }
    return true;
  }

  const empty = turns.length === 0;

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-gold/10 bg-night/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
          <Link
            href="/"
            className="-ml-1 rounded-full px-2 py-1 text-lg text-stone transition hover:text-gold"
            aria-label="Back to all philosophers"
          >
            ←
          </Link>
          <Portrait philosopher={philosopher} size={40} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl leading-none text-parchment">{philosopher.name}</h1>
            <p className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-dust">
              {philosopher.lifespan} · {philosopher.role}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="shrink-0 rounded-full border border-gold/30 px-3 py-1 text-xs text-stone transition hover:border-gold/60 hover:text-gold-bright"
            aria-expanded={showGuide}
          >
            How to read
          </button>
        </div>
        {showGuide && <ReadingGuide name={philosopher.name} />}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-8 pt-8 sm:px-5">
        {empty && (
          <section className="animate-rise flex flex-col items-center pt-4 text-center sm:pt-10">
            <Portrait philosopher={philosopher} size={144} preload className="shadow-[0_0_60px_-10px_rgba(201,169,110,0.45)]" />
            <p className="mt-3 text-xs text-dust">AI-generated portrait · artistic interpretation</p>
            <p className="mt-4 font-serif text-base text-stone">{philosopher.nativeName}</p>
            <blockquote className="mt-8 max-w-xl">
              <p className="font-display text-3xl italic leading-snug text-parchment sm:text-4xl">“{philosopher.opening.text}”</p>
              <footer className="mt-4 text-xs uppercase tracking-[0.2em] text-dust">{philosopher.opening.ref}</footer>
            </blockquote>
            <LaurelDivider className="mt-10 w-full max-w-md" />
            <p className="mt-8 text-sm text-stone">Bring him a question that is troubling you — in any language.</p>
            <div className="mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
              {philosopher.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-gold/20 bg-umber/60 px-4 py-2 text-left text-sm text-parchment/90 transition hover:border-gold/50 hover:bg-ash hover:text-parchment"
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
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm border border-white/5 bg-ash/80 px-5 py-3 text-[1rem] leading-relaxed text-parchment/90">
                  {turn.content}
                </p>
              </li>
            ) : (
              <li key={turn.id} className="animate-rise">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-gold">
                  <span>{philosopher.name}</span>
                  <span className="normal-case tracking-normal text-dust">· AI portrayal</span>
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
      </main>

      <Composer
        label={`Your message to ${philosopher.name}`}
        placeholder={`Speak to ${philosopher.name}…`}
        busy={busy}
        onSend={ask}
        onStop={() => abortRef.current?.abort()}
      />
      <div ref={endRef} />
    </div>
  );
}
