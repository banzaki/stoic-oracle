"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CouncilEvent, CouncilRequest } from "@/lib/chat-protocol";
import type { SourcePassage } from "@/lib/corpus/types";
import { getPhilosopher, type PhilosopherId } from "@/lib/philosophers";
import { LaurelDivider } from "../Laurel";
import { Portrait } from "../Portrait";
import { Composer } from "../chat/Composer";
import { ConversationMenu } from "../chat/ConversationMenu";
import { conversationAsMarkdown, downloadFile } from "../chat/export";
import { LatestButton } from "../chat/LatestButton";
import { ErrorNotice } from "../chat/ErrorNotice";
import { readEvents } from "../chat/read-events";
import { ReadingGuide } from "../chat/ReadingGuide";
import { Reply } from "../chat/Reply";
import { forget, save, useSaved } from "../chat/saved-conversation";
import { useFollowScroll } from "../chat/use-follow-scroll";
import { CouncilLineup } from "./CouncilLineup";

interface Speech {
  id: string;
  speaker: PhilosopherId;
  content: string;
  sources: SourcePassage[];
  status: "streaming" | "done" | "error";
  error?: { code: string; message: string };
}

interface Round {
  id: string;
  question: string;
  speeches: Speech[];
  /** ISO 639-1 code of the visitor's language for this round. */
  language?: string;
  status: "streaming" | "done" | "error";
  error?: { code: string; message: string };
}

const SUGGESTIONS = [
  "Is it wrong to be ambitious?",
  "Should I forgive someone who betrayed me?",
  "How do I face the death of someone I love?",
  "Is wealth an obstacle to a good life?",
];

const DEFAULT_LINEUP: PhilosopherId[] = ["epictetus", "seneca", "marcus-aurelius"];
const COUNT_WORDS = ["", "One", "Two", "Three"];

let nextId = 0;
const newId = () => `c${Date.now().toString(36)}${(nextId++).toString(36)}`;

interface SavedCouncil {
  rounds: Round[];
  lineup: PhilosopherId[];
}

const STORAGE_KEY = "council";

export function CouncilRoom() {
  // A saved council remounts the room with it, once the page has hydrated.
  const saved = useSaved<SavedCouncil>(STORAGE_KEY);
  return <Council key={saved ? "restored" : "new"} initial={saved} />;
}

function Council({ initial }: { initial: SavedCouncil | null }) {
  const [rounds, setRounds] = useState<Round[]>(initial?.rounds ?? []);
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  // Who speaks, in order; read when a question is sent, so changes never touch earlier rounds.
  const [lineup, setLineup] = useState<PhilosopherId[]>(initial?.lineup ?? DEFAULT_LINEUP);
  const abortRef = useRef<AbortController | null>(null);

  const knownSources = useMemo(() => {
    const map = new Map<string, SourcePassage>();
    for (const r of rounds) for (const s of r.speeches) for (const p of s.sources) map.set(p.id, p);
    return map;
  }, [rounds]);

  // Grows with every round, speaker and streamed character; zero before the first question.
  const progress = rounds.reduce(
    (n, r) => n + 1 + r.speeches.reduce((m, s) => m + 1 + s.content.length + s.sources.length, 0),
    0,
  );
  const { detached, jumpToLatest, follow } = useFollowScroll(progress);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Saved whenever no one is speaking: the rounds so far and the chosen lineup.
  useEffect(() => {
    if (busy || !rounds.length) return;
    const settled = rounds.map((r) => ({ ...r, speeches: r.speeches.filter((s) => s.status !== "streaming") }));
    save<SavedCouncil>(STORAGE_KEY, { rounds: settled, lineup });
  }, [busy, rounds, lineup]);

  function startOver() {
    abortRef.current?.abort();
    forget(STORAGE_KEY);
    setRounds([]);
    window.scrollTo({ top: 0 });
  }

  function exportCouncil() {
    const entries = rounds.flatMap((r) => [
      { speaker: "You", content: r.question },
      ...r.speeches.map((s) => ({ speaker: getPhilosopher(s.speaker).name, content: s.content })),
    ]);
    const markdown = conversationAsMarkdown("The Council of the Stoa", entries, knownSources);
    downloadFile(`stoic-oracle-council-${new Date().toISOString().slice(0, 10)}.md`, markdown);
  }

  const updateRound = (id: string, patch: (r: Round) => Partial<Round>) =>
    setRounds((all) => all.map((r) => (r.id === id ? { ...r, ...patch(r) } : r)));

  const updateSpeech = (roundId: string, speaker: PhilosopherId, patch: (s: Speech) => Partial<Speech>) =>
    updateRound(roundId, (r) => ({
      speeches: r.speeches.some((s) => s.speaker === speaker)
        ? r.speeches.map((s) => (s.speaker === speaker ? { ...s, ...patch(s) } : s))
        : [...r.speeches, { id: newId(), speaker, content: "", sources: [], status: "streaming" as const, ...patch({} as Speech) }],
    }));

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    const previous: CouncilRequest["rounds"] = rounds
      .filter((r) => r.speeches.some((s) => s.status === "done"))
      .map((r) => ({
        question: r.question,
        replies: r.speeches.filter((s) => s.status === "done" && s.content.trim()).map((s) => ({ speaker: s.speaker, content: s.content })),
      }));
    const round: Round = { id: newId(), question: text, speeches: [], status: "streaming" };
    follow();
    setRounds((all) => [...all, round]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rounds: previous, question: text, speakers: lineup } satisfies CouncilRequest),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => null);
        const error = payload?.error ?? { code: "server_error", message: `Request failed (${res.status}).` };
        updateRound(round.id, () => ({ status: "error", error }));
        return;
      }

      let finished = false;
      for await (const event of readEvents<CouncilEvent>(res.body)) {
        switch (event.type) {
          case "language":
            updateRound(round.id, () => ({ language: event.code }));
            break;
          case "speaker":
            updateSpeech(round.id, event.speaker, () => ({}));
            break;
          case "sources":
            updateSpeech(round.id, event.speaker, () => ({ sources: event.passages }));
            break;
          case "text":
            updateSpeech(round.id, event.speaker, (s) => ({ content: (s.content ?? "") + event.text }));
            break;
          case "speaker_done":
            updateSpeech(round.id, event.speaker, () => ({ status: "done" }));
            break;
          case "error":
            if (event.speaker) {
              updateSpeech(round.id, event.speaker, () => ({ status: "error", error: event }));
            } else {
              finished = true;
              updateRound(round.id, () => ({ status: "error", error: event }));
            }
            break;
          case "done":
            finished = true;
            updateRound(round.id, () => ({ status: "done" }));
            break;
        }
      }
      if (!finished) {
        updateRound(round.id, () => ({
          status: "error",
          error: { code: "interrupted", message: "The connection closed before the council finished." },
        }));
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Keep what was said; mark the speech that was cut off as finished where it stopped.
        updateRound(round.id, (r) => ({
          status: "done",
          speeches: r.speeches.map((s) => (s.status === "streaming" ? { ...s, status: s.content ? "done" : "error", error: s.content ? undefined : { code: "stopped", message: "Stopped." } } : s)),
        }));
      } else {
        console.error(err);
        updateRound(round.id, () => ({ status: "error", error: { code: "network", message: "Could not reach the server." } }));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-gold/10 bg-night/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
          <Link href="/" className="-ml-1 rounded-full px-2 py-1 text-lg text-stone transition hover:text-gold" aria-label="Back to all philosophers">
            ←
          </Link>
          <div className="flex -space-x-3">
            {lineup.map((id) => (
              <Portrait key={id} philosopher={getPhilosopher(id)} size={34} className="ring-2 ring-night" />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl leading-none text-parchment sm:text-2xl">The Council of the Stoa</h1>
            <p className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-dust">{COUNT_WORDS[lineup.length]} voices · one question</p>
          </div>
          <ConversationMenu disabled={rounds.length === 0 || busy} onNew={startOver} onExport={exportCouncil} />
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="shrink-0 rounded-full border border-gold/30 px-3 py-1 text-xs text-stone transition hover:border-gold/60 hover:text-gold-bright"
            aria-expanded={showGuide}
            aria-label="How to read"
          >
            <span aria-hidden="true" className="sm:hidden">?</span>
            <span aria-hidden="true" className="hidden sm:inline">How to read</span>
          </button>
        </div>
        {showGuide && <ReadingGuide name="each philosopher" />}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-8 pt-8 sm:px-5">
        {rounds.length === 0 && (
          <section className="animate-rise flex flex-col items-center pt-4 text-center sm:pt-10">
            <div className="flex -space-x-6">
              {lineup.map((id) => (
                <Portrait key={id} philosopher={getPhilosopher(id)} size={104} preload className="ring-4 ring-night" />
              ))}
            </div>
            <p className="mt-8 max-w-xl font-serif text-xl leading-relaxed text-stone">
              In life they never sat together. Here the freedman, the statesman and the emperor answer you in turn — and
              each hears what the others said.
            </p>
            <LaurelDivider className="mt-10 w-full max-w-md" />
            <p className="mt-8 text-sm text-stone">Put a question to the council — in any language.</p>
            <div className="mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
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

        <ol className="space-y-12">
          {rounds.map((round) => (
            <li key={round.id} className="space-y-8">
              <div className="animate-rise flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm border border-white/5 bg-ash/80 px-5 py-3 text-[1rem] leading-relaxed text-parchment/90">
                  {round.question}
                </p>
              </div>
              {round.speeches.map((speech) => {
                const philosopher = getPhilosopher(speech.speaker);
                return (
                  <article key={speech.id} className="animate-rise border-l border-gold/15 pl-4 sm:pl-5">
                    <div className="mb-3 flex items-center gap-3">
                      <Portrait philosopher={philosopher} size={32} />
                      <span className="text-xs uppercase tracking-[0.22em] text-gold">{philosopher.name}</span>
                      <span className="text-xs text-dust">· AI portrayal</span>
                    </div>
                    {speech.status === "streaming" && !speech.content && (
                      <p className="animate-flicker font-serif text-lg italic text-stone">He considers the question…</p>
                    )}
                    {speech.content && (
                      <Reply
                        replyId={speech.id}
                        text={speech.content}
                        streaming={speech.status === "streaming"}
                        sources={speech.sources}
                        knownSources={knownSources}
                        speaker={philosopher}
                        language={round.language ?? "en"}
                      />
                    )}
                    {speech.status === "error" && speech.error && <ErrorNotice error={speech.error} />}
                  </article>
                );
              })}
              {round.status === "error" && round.error && <ErrorNotice error={round.error} />}
            </li>
          ))}
        </ol>
      </main>

      <Composer
        label="Your question to the council"
        placeholder="Ask the council…"
        busy={busy}
        onSend={ask}
        onStop={() => abortRef.current?.abort()}
        toolbar={<CouncilLineup lineup={lineup} onChange={setLineup} />}
        notice={detached && rounds.length > 0 ? <LatestButton onClick={jumpToLatest} streaming={busy} /> : null}
      />
    </div>
  );
}
