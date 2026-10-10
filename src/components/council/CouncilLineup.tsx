"use client";

import { useId, useState } from "react";
import { getPhilosopher, PHILOSOPHER_IDS, type PhilosopherId } from "@/lib/philosophers";
import { Portrait } from "../Portrait";

const SHORT_NAMES: Record<PhilosopherId, string> = {
  "marcus-aurelius": "Marcus",
  epictetus: "Epictetus",
  seneca: "Seneca",
};

interface CouncilLineupProps {
  /** Two or three philosophers, in speaking order. */
  lineup: PhilosopherId[];
  onChange: (lineup: PhilosopherId[]) => void;
}

/**
 * Who sits in the council and in what order they speak. Collapsed, it reads as one line;
 * opened, each philosopher can be left out (at least two remain) or moved up and down.
 * Changes apply to the next question only.
 */
export function CouncilLineup({ lineup, onChange }: CouncilLineupProps) {
  const [editing, setEditing] = useState(false);
  const panelId = useId();
  const absent = PHILOSOPHER_IDS.filter((id) => !lineup.includes(id));

  const move = (index: number, by: -1 | 1) => {
    const next = [...lineup];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };
  const toggle = (id: PhilosopherId) => {
    if (lineup.includes(id)) {
      if (lineup.length > 2) onChange(lineup.filter((x) => x !== id));
    } else {
      onChange([...lineup, id]);
    }
  };

  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border border-gold/20 text-sm text-stone transition hover:border-gold/60 hover:text-gold-bright disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-gold/20 disabled:hover:text-stone";

  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <span className="hidden shrink-0 text-xs uppercase tracking-[0.18em] text-dust sm:inline">Speaking order</span>
        <ol className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden" aria-label="Speaking order">
          {lineup.map((id, i) => (
            <li key={id} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden="true" className="text-xs text-dust">
                  ›
                </span>
              )}
              <span
                title={getPhilosopher(id).name}
                className="flex items-center gap-1.5 rounded-full border border-gold/15 bg-umber py-0.5 pl-2 pr-0.5 sm:pr-2.5"
              >
                <span className="text-xs font-semibold text-gold">{i + 1}</span>
                <Portrait philosopher={getPhilosopher(id)} size={22} className="ring-0" />
                {/* Names fit from small tablets up; on phones the portrait and number carry the order. */}
                <span className="hidden text-xs text-parchment/90 sm:inline">{SHORT_NAMES[id]}</span>
                <span className="sr-only sm:hidden">{getPhilosopher(id).name}</span>
              </span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          aria-controls={panelId}
          className="shrink-0 rounded-full border border-gold/30 px-3 py-1 text-xs text-stone transition hover:border-gold/60 hover:text-gold-bright"
        >
          {editing ? "Done" : "Change"}
        </button>
      </div>

      {editing && (
        <div id={panelId} className="animate-rise mt-2 rounded-xl border border-gold/15 bg-umber/95 p-2">
          <ul className="space-y-1">
            {[...lineup, ...absent].map((id) => {
              const index = lineup.indexOf(id);
              const present = index !== -1;
              const philosopher = getPhilosopher(id);
              return (
                <li key={id} className="flex items-center gap-2 rounded-lg px-1.5 py-1">
                  <span className="w-4 text-center text-xs font-semibold text-gold">{present ? index + 1 : ""}</span>
                  <Portrait
                    philosopher={philosopher}
                    size={30}
                    className={present ? "" : "opacity-40 grayscale"}
                  />
                  <span className={`min-w-0 flex-1 truncate ${present ? "text-parchment" : "text-dust line-through decoration-dust/50"}`}>
                    {philosopher.name}
                  </span>
                  {present && (
                    <>
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${philosopher.name} earlier`}
                        className={iconButton}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === lineup.length - 1}
                        aria-label={`Move ${philosopher.name} later`}
                        className={iconButton}
                      >
                        ↓
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    disabled={present && lineup.length <= 2}
                    aria-pressed={present}
                    title={present && lineup.length <= 2 ? "The council needs at least two voices." : undefined}
                    className={`h-8 min-w-[4.5rem] rounded-full border px-3 text-xs transition disabled:cursor-not-allowed disabled:opacity-30 ${
                      present
                        ? "border-gold/50 bg-gold/10 text-gold-bright hover:bg-gold/20"
                        : "border-gold/20 text-stone hover:border-gold/60 hover:text-gold-bright"
                    }`}
                  >
                    {present ? "Remove" : "Invite"}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-1.5 pt-1.5 text-xs text-dust">Applies to your next question; earlier answers stay as they were.</p>
        </div>
      )}
    </div>
  );
}
