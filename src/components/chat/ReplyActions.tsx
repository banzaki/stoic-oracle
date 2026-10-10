"use client";

import { useState } from "react";
import type { SourcePassage } from "@/lib/corpus/types";
import type { Philosopher } from "@/lib/philosophers";
import { replyAsText } from "./export";
import { renderReplyCard, shareOrDownload } from "./share-card";

/** Small text buttons under a finished reply: copy it as text, or share it as an image card. */
export function ReplyActions({
  speaker,
  text,
  knownSources,
}: {
  speaker: Philosopher;
  text: string;
  knownSources: Map<string, SourcePassage>;
}) {
  const [state, setState] = useState<"idle" | "copied" | "drawing" | "failed">("idle");

  async function copy() {
    const { text: prose, cited } = replyAsText(text, knownSources);
    const refs = cited.map((p, i) => `[${i + 1}] ${p.ref}, tr. ${p.translator}`).join("\n");
    const full = `${prose}\n\n— ${speaker.name} (AI portrayal, Stoic Oracle)${refs ? `\n\n${refs}` : ""}`;
    try {
      await navigator.clipboard.writeText(full);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  async function share() {
    setState("drawing");
    try {
      const { text: prose } = replyAsText(text, knownSources, { originals: false });
      const blob = await renderReplyCard({
        name: speaker.name,
        subtitle: `${speaker.lifespan} · ${speaker.role}`,
        portrait: speaker.portrait,
        text: prose.replace(/\s*\[\d+\]/g, ""),
      });
      await shareOrDownload(blob, `stoic-oracle-${speaker.id}.png`, `${speaker.name} · Stoic Oracle`);
      setState("idle");
    } catch (error) {
      console.error(error);
      setState("failed");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  const button = "rounded-full px-2 py-1 text-xs text-dust transition hover:text-gold disabled:opacity-50";
  return (
    <div className="flex shrink-0 items-center gap-1" aria-live="polite">
      <button type="button" onClick={copy} className={button}>
        {state === "copied" ? "Copied ✓" : "Copy"}
      </button>
      <button type="button" onClick={share} disabled={state === "drawing"} className={button}>
        {state === "drawing" ? "Drawing…" : state === "failed" ? "Not available" : "Image"}
      </button>
    </div>
  );
}
