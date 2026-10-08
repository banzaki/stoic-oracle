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
      <figcaption className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
        {number !== undefined && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold/15 px-1.5 font-semibold text-gold">
            {number}
          </span>
        )}
        <span className="font-medium text-parchment/90">{passage.ref}</span>
        <span className="text-dust">
          · tr.{" "}
          <a href={passage.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-dust/50 hover:text-stone">
            {passage.translator}
          </a>
        </span>
      </figcaption>
      {passage.note && <p className="mt-1 text-xs italic text-ember/80">{passage.note}</p>}
      <blockquote className="mt-3 whitespace-pre-line border-l-2 border-gold/30 pl-4 font-serif text-[0.98rem] leading-relaxed text-stone">
        {shown}
      </blockquote>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs text-gold/80 hover:text-gold-bright"
        >
          {expanded ? "Show less" : "Read the full passage"}
        </button>
      )}
    </figure>
  );
}
