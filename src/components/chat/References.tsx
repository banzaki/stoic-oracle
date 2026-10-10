"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import type { SourcePassage } from "@/lib/corpus/types";
import { replyLabels, translatesPassages } from "@/lib/i18n";
import { SourceCard } from "./SourceCard";

interface ReferencesProps {
  replyId: string;
  /** Passages cited in the reply, numbered as in the text. */
  cited: SourcePassage[];
  numbers: Map<string, number>;
  /** Passages retrieved for the reply but not cited in it. */
  consulted: SourcePassage[];
  language: string;
  open: boolean;
  onToggle: () => void;
  /** A footnote the visitor clicked: scrolled into view and highlighted. */
  focus: { id: string; at: number } | null;
  /** Shown at the right of the summary line (e.g. copy / share). */
  actions?: ReactNode;
}

/**
 * The sources of one reply, collapsed to a single line until the visitor opens them.
 * Cited passages come first; passages that were only consulted sit in their own fold.
 * Cards mount only when shown, so translations are requested only for what is read.
 */
export function References({
  replyId,
  cited,
  numbers,
  consulted,
  language,
  open,
  onToggle,
  focus,
  actions,
}: ReferencesProps) {
  const labels = replyLabels(language);
  const panelId = useId();
  const consultedId = useId();
  const [consultedOpen, setConsultedOpen] = useState(cited.length === 0);

  useEffect(() => {
    if (!focus || !open) return;
    const card = document.getElementById(`${replyId}-src-${focus.id}`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.focus({ preventScroll: true });
  }, [focus, open, replyId]);

  const summary = cited.length > 0 ? labels.references(cited.length) : labels.consulted(consulted.length);

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="group inline-flex items-center gap-2 rounded-full py-1 pr-2 text-sm text-dust transition hover:text-gold"
        >
          <span aria-hidden="true" className={`inline-block text-gold/70 transition ${open ? "rotate-90" : ""}`}>
            ›
          </span>
          <span className="border-b border-transparent group-hover:border-gold/40">{summary}</span>
        </button>
        {actions}
      </div>

      {open && (
        <div id={panelId} className="animate-rise mt-3 space-y-3">
          {translatesPassages(language) && labels.translationNote && (
            <p className="text-xs leading-relaxed text-dust">{labels.translationNote}</p>
          )}

          {cited.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-dust">{labels.citedHeading}</p>
              {cited.map((s) => (
                <SourceCard
                  key={s.id}
                  id={`${replyId}-src-${s.id}`}
                  passage={s}
                  number={numbers.get(s.id)}
                  language={language}
                  highlighted={focus?.id === s.id}
                />
              ))}
            </>
          )}

          {consulted.length > 0 && cited.length > 0 && (
            <button
              type="button"
              onClick={() => setConsultedOpen((v) => !v)}
              aria-expanded={consultedOpen}
              aria-controls={consultedId}
              className="inline-flex items-center gap-2 pt-1 text-sm text-dust transition hover:text-stone"
            >
              <span aria-hidden="true" className={`inline-block transition ${consultedOpen ? "rotate-90" : ""}`}>
                ›
              </span>
              {labels.alsoConsulted(consulted.length)}
            </button>
          )}
          {consulted.length > 0 && consultedOpen && (
            <div id={consultedId} className="space-y-3">
              {consulted.map((s) => (
                <SourceCard key={s.id} id={`${replyId}-src-${s.id}`} passage={s} language={language} muted />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
