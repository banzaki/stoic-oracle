import type { SourcePassage } from "@/lib/corpus/types";
import { citedIds, segmentReply } from "@/lib/quotes";

/**
 * A reply as plain prose: quotations in curly quotes, citations as [n] in order of first use.
 * Translated quotations keep their English original in brackets unless `originals` is false.
 */
export function replyAsText(
  reply: string,
  known: Map<string, SourcePassage>,
  { originals = true }: { originals?: boolean } = {},
): { text: string; cited: SourcePassage[] } {
  const cited = citedIds(reply)
    .map((id) => known.get(id))
    .filter((p): p is SourcePassage => Boolean(p));
  const numbers = new Map(cited.map((p, i) => [p.id, i + 1]));
  const pool = [...known.values()];
  const text = reply
    .split(/\n{2,}/)
    .map((paragraph) =>
      segmentReply(paragraph.trim(), pool)
        .map((s) => {
          if (s.kind === "text") return s.text.replace(/\*([^*\n]+)\*/g, "$1");
          if (s.kind === "quote") return originals && s.original ? `“${s.text}” (“${s.original}”)` : `“${s.text}”`;
          const n = numbers.get(s.id);
          return n ? `[${n}]` : "";
        })
        .join("")
        .replace(/ +([.,;:!?])/g, "$1"),
    )
    .filter(Boolean)
    .join("\n\n");
  return { text, cited };
}

export interface ExportEntry {
  /** "You", or the philosopher's name. */
  speaker: string;
  content: string;
}

/** The whole conversation as Markdown, with each reply's references and a note on what it is. */
export function conversationAsMarkdown(title: string, entries: ExportEntry[], known: Map<string, SourcePassage>): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const lines = [`# ${title}`, "", `*Stoic Oracle · ${date}*`, ""];
  for (const entry of entries) {
    if (entry.speaker === "You") {
      lines.push(`**You:** ${entry.content}`, "");
      continue;
    }
    const { text, cited } = replyAsText(entry.content, known);
    lines.push(`**${entry.speaker}** *(AI portrayal)*`, "", text, "");
    if (cited.length) {
      cited.forEach((p, i) =>
        lines.push(`> [${i + 1}] ${p.ref} — tr. ${p.translator}, ${p.source} (${p.sourceUrl})`),
      );
      lines.push("");
    }
  }
  lines.push(
    "---",
    "",
    "The philosophers are AI portrayals grounded in public-domain translations of their own writings. " +
      "Quotations were checked against those texts; everything else is interpretation.",
    "",
  );
  return lines.join("\n");
}

/** Starts a download of `content` as a file. */
export function downloadFile(name: string, content: Blob | string, type = "text/markdown;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
