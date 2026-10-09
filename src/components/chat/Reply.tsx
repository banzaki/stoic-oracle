"use client";

import { Fragment, useMemo } from "react";
import type { SourcePassage } from "@/lib/corpus/types";
import { citedIds, segmentReply, type Segment } from "@/lib/quotes";
import { SourceCard } from "./SourceCard";

interface ReplyProps {
  text: string;
  streaming: boolean;
  /** Passages retrieved for this turn. */
  sources: SourcePassage[];
  /** Every passage seen in the conversation, for citations to earlier turns. */
  knownSources: Map<string, SourcePassage>;
  replyId: string;
}

function Emphasis({ text }: { text: string }) {
  const parts = text.split(/\*([^*\n]+)\*/g);
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

export function Reply({ text, streaming, sources, knownSources, replyId }: ReplyProps) {
  // Hide a half-streamed citation marker such as "[ench-" until it completes.
  const visible = streaming ? text.replace(/\[[^\]\n]*$/, "") : text;

  const { paragraphs, numbers, cited, consulted } = useMemo(() => {
    const ids = citedIds(visible);
    const numbers = new Map<string, number>();
    const cited: SourcePassage[] = [];
    for (const id of ids) {
      const passage = knownSources.get(id);
      if (passage && !numbers.has(id)) {
        numbers.set(id, cited.length + 1);
        cited.push(passage);
      }
    }
    const pool = [...knownSources.values()];
    const paragraphs = visible
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => segmentReply(p, pool));
    const consulted = sources.filter((s) => !numbers.has(s.id));
    return { paragraphs, numbers, cited, consulted };
  }, [visible, knownSources, sources]);

  const renderSegment = (segment: Segment, key: number) => {
    switch (segment.kind) {
      case "text":
        return <Emphasis key={key} text={segment.text} />;
      case "citation": {
        const n = numbers.get(segment.id);
        if (!n) {
          return (
            <sup key={key} title="This reference does not match any passage in the library." className="ml-0.5 text-[0.7em] text-ember">
              [?]
            </sup>
          );
        }
        return (
          <sup key={key} className="ml-0.5">
            <a
              href={`#${replyId}-src-${segment.id}`}
              className="rounded px-0.5 font-sans text-[0.7em] font-semibold text-gold hover:bg-gold/15 hover:text-gold-bright"
              title={knownSources.get(segment.id)?.ref}
            >
              {n}
            </a>
          </sup>
        );
      }
      case "quote": {
        if (segment.verifiedIn) {
          const ref = knownSources.get(segment.verifiedIn)?.ref;
          return (
            <Fragment key={key}>
              <q
                className="border-b border-gold/40 text-gold-bright before:content-['“'] after:content-['”']"
                title={`Verbatim from ${ref ?? "the library"}`}
              >
                {segment.text}
              </q>
              <span aria-label="verified quotation" className="ml-0.5 align-super font-sans text-[0.6em] text-gold">
                ✓
              </span>
            </Fragment>
          );
        }
        return (
          <Fragment key={key}>
            <q
              className="border-b border-dashed border-ember/50 before:content-['“'] after:content-['”']"
              title="Attributed to the library but not found there word for word — read it as paraphrase."
            >
              {segment.text}
            </q>
            <span aria-label="unverified wording" className="ml-0.5 align-super font-sans text-[0.6em] text-ember">
              ≈
            </span>
          </Fragment>
        );
      }
    }
  };

  return (
    <div>
      <div className="space-y-4 font-serif text-[1.15rem] leading-[1.7] text-parchment/95">
        {paragraphs.map((segments, i) => (
          <p key={i}>
            {segments.map(renderSegment)}
            {streaming && i === paragraphs.length - 1 && (
              <span className="animate-flicker ml-1 inline-block h-4 w-[2px] translate-y-0.5 bg-gold" />
            )}
          </p>
        ))}
      </div>

      {!streaming && cited.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-xs uppercase tracking-[0.22em] text-dust">From the library · authentic text</p>
          {cited.map((s) => (
            <SourceCard key={s.id} id={`${replyId}-src-${s.id}`} passage={s} number={numbers.get(s.id)} />
          ))}
        </div>
      )}

      {!streaming && consulted.length > 0 && (
        <details className="group mt-4">
          <summary className="cursor-pointer list-none text-sm text-dust transition hover:text-stone">
            <span className="mr-1 inline-block transition group-open:rotate-90">›</span>
            {consulted.length} other passage{consulted.length === 1 ? "" : "s"} consulted
          </summary>
          <div className="mt-3 space-y-3">
            {consulted.map((s) => (
              <SourceCard key={s.id} id={`${replyId}-src-${s.id}`} passage={s} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
