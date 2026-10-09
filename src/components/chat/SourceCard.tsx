"use client";

import { useState } from "react";
import type { SourcePassage } from "@/lib/corpus/types";

const PREVIEW_CHARS = 320;

export function SourceCard({ id, passage, number }: { id: string; passage: SourcePassage; number?: number }) {
  const [expanded, setExpanded] = useState(false);
  const long = passage.text.length > PREVIEW_CHARS;
  const shown = expanded || !long ? passage.text : `${passage.text.slice(0, PREVIEW_CHARS).trimEnd()}…`;

  return (
    <figure
      id={id}
      className="scroll-mt-24 rounded-xl border border-gold/15 bg-umber/70 px-5 py-4 target:border-gold/60 target:bg-ash"
    >
      <figcaption className="flex items-baseline gap-2 text-sm">
        {number !== undefined && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold/15 px-1.5 text-xs font-semibold text-gold">
            {number}
          </span>
        )}
        <span className="font-medium text-parchment/90">{passage.ref}</span>
      </figcaption>
      {passage.note && <p className="mt-1 text-xs italic text-ember">{passage.note}</p>}
      <blockquote className="mt-3 whitespace-pre-line border-l-2 border-gold/30 pl-4 font-serif text-[1.02rem] leading-relaxed text-stone">
        {shown}
      </blockquote>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-xs">
        {long && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-gold hover:text-gold-bright"
          >
            {expanded ? "Show less" : "Read the full passage"}
          </button>
        )}
        <details className="group">
          <summary className="cursor-pointer list-none text-dust transition hover:text-stone">
            <span className="mr-1 inline-block transition group-open:rotate-90">›</span>
            About this source
          </summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-stone">
            <dt className="text-dust">Work</dt>
            <dd>{passage.work}</dd>
            <dt className="text-dust">Translation</dt>
            <dd>{passage.translator}</dd>
            <dt className="text-dust">Edition</dt>
            <dd>
              <a href={passage.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-dust/60 underline-offset-2 hover:text-gold">
                {passage.source}
              </a>
            </dd>
          </dl>
        </details>
      </div>
    </figure>
  );
}
