"use client";

import { useState } from "react";
import type { SourcePassage } from "@/lib/corpus/types";
import { replyLabels } from "@/lib/i18n";
import { usePassageTranslation } from "./use-passage-translation";

const PREVIEW_CHARS = 320;

interface SourceCardProps {
  id: string;
  passage: SourcePassage;
  number?: number;
  /** Conversation language: other than English, the passage is shown in an AI translation. */
  language?: string;
  highlighted?: boolean;
  /** For passages that were consulted but not cited. */
  muted?: boolean;
}

export function SourceCard({ id, passage, number, language = "en", highlighted = false, muted = false }: SourceCardProps) {
  const labels = replyLabels(language);
  const translation = usePassageTranslation(passage.id, language);
  const [expanded, setExpanded] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const translated = translation.status === "done" && !showOriginal;
  const text = translated ? translation.text : passage.text;
  const long = text.length > PREVIEW_CHARS;
  const shown = expanded || !long ? text : `${text.slice(0, PREVIEW_CHARS).trimEnd()}…`;

  return (
    <figure
      id={id}
      tabIndex={-1}
      className={`scroll-mt-24 rounded-xl border px-5 py-4 outline-none transition-colors ${
        highlighted ? "border-gold/60 bg-ash" : muted ? "border-gold/10 bg-umber/50" : "border-gold/15 bg-umber/70"
      }`}
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

      {translation.status !== "none" && (
        <p className="mt-2 text-xs text-dust">
          {translation.status === "loading" && <span className="animate-flicker">{labels.translating}</span>}
          {translation.status === "failed" && labels.translationFailed}
          {translation.status === "done" &&
            (showOriginal ? labels.original(passage.translator) : labels.aiTranslation(passage.translator))}
        </p>
      )}

      <blockquote
        lang={translated ? language : "en"}
        className={`mt-3 whitespace-pre-line border-l-2 border-gold/30 pl-4 font-serif text-[1.02rem] leading-relaxed text-stone ${
          translation.status === "loading" ? "opacity-60" : ""
        }`}
      >
        {shown}
      </blockquote>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-xs">
        {long && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-gold hover:text-gold-bright">
            {expanded ? labels.showLess : labels.readFull}
          </button>
        )}
        {translation.status === "done" && (
          <button type="button" onClick={() => setShowOriginal((v) => !v)} className="text-gold hover:text-gold-bright">
            {showOriginal ? labels.showTranslation : labels.showOriginal}
          </button>
        )}
        <details className="group">
          <summary className="cursor-pointer list-none text-dust transition hover:text-stone">
            <span className="mr-1 inline-block transition group-open:rotate-90">›</span>
            {labels.aboutSource}
          </summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-stone">
            <dt className="text-dust">{labels.work}</dt>
            <dd>{passage.work}</dd>
            <dt className="text-dust">{labels.translation}</dt>
            <dd>{passage.translator}</dd>
            <dt className="text-dust">{labels.edition}</dt>
            <dd>
              <a
                href={passage.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dust/60 underline-offset-2 hover:text-gold"
              >
                {passage.source}
              </a>
            </dd>
          </dl>
        </details>
      </div>
    </figure>
  );
}
