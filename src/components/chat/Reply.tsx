"use client";

import { Fragment, useMemo, useState } from "react";
import type { SourcePassage } from "@/lib/corpus/types";
import { replyLabels } from "@/lib/i18n";
import { citedIds, segmentReply, type Segment } from "@/lib/quotes";
import { References } from "./References";

interface ReplyProps {
  text: string;
  streaming: boolean;
  /** Passages retrieved for this turn. */
  sources: SourcePassage[];
  /** Every passage seen in the conversation, for citations to earlier turns. */
  knownSources: Map<string, SourcePassage>;
  replyId: string;
  /** ISO 639-1 code of the conversation's language. */
  language: string;
}

function Emphasis({ text }: { text: string }) {
  const parts = text.split(/\*([^*\n]+)\*/g);
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

export function Reply({ text, streaming, sources, knownSources, replyId, language }: ReplyProps) {
  const labels = replyLabels(language);
  const [referencesOpen, setReferencesOpen] = useState(false);
  // The source the visitor asked to see by clicking a footnote number.
  const [focus, setFocus] = useState<{ id: string; at: number } | null>(null);

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
            <sup key={key} title={labels.unknownReference} className="ml-0.5 text-[0.7em] text-ember">
              [?]
            </sup>
          );
        }
        return (
          <sup key={key} className="ml-0.5">
            <a
              href={`#${replyId}-src-${segment.id}`}
              onClick={(e) => {
                e.preventDefault();
                setReferencesOpen(true);
                setFocus({ id: segment.id, at: Date.now() });
              }}
              className="rounded px-0.5 font-sans text-[0.7em] font-semibold text-gold hover:bg-gold/15 hover:text-gold-bright"
              title={knownSources.get(segment.id)?.ref}
            >
              {n}
            </a>
          </sup>
        );
      }
      case "quote": {
        const ref = segment.verifiedIn ? (knownSources.get(segment.verifiedIn)?.ref ?? segment.verifiedIn) : "";
        const original = segment.original ? `\n“${segment.original}”` : "";
        if (segment.verifiedIn) {
          const note = segment.original ? labels.verifiedTranslated(ref) : labels.verified(ref);
          return (
            <Fragment key={key}>
              <q
                className="border-b border-gold/40 text-gold-bright before:content-['“'] after:content-['”']"
                title={note + original}
              >
                {segment.text}
              </q>
              <span aria-label={note} className="ml-0.5 whitespace-nowrap align-super font-sans text-[0.6em] text-gold">
                ✓{segment.original && labels.translatedMark ? ` ${labels.translatedMark}` : ""}
              </span>
            </Fragment>
          );
        }
        return (
          <Fragment key={key}>
            <q
              className="border-b border-dashed border-ember/50 before:content-['“'] after:content-['”']"
              title={labels.unverified + original}
            >
              {segment.text}
            </q>
            <span aria-label={labels.unverified} className="ml-0.5 align-super font-sans text-[0.6em] text-ember">
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

      {!streaming && (cited.length > 0 || consulted.length > 0) && (
        <References
          replyId={replyId}
          cited={cited}
          numbers={numbers}
          consulted={consulted}
          language={language}
          open={referencesOpen}
          onToggle={() => setReferencesOpen((v) => !v)}
          focus={focus}
        />
      )}
    </div>
  );
}
