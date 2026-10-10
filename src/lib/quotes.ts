/**
 * Splits a philosopher's reply into renderable segments and checks quotations
 * against the verbatim library passages.
 *
 * A quotation followed by a citation, as in `"..." [ench-5]`, claims to be the
 * philosopher's recorded words: it is shown as authentic only if its words appear,
 * in order, inside one of the passages, and flagged as unverified otherwise.
 *
 * In other languages the quotation is a translation and the English original travels
 * inside the citation, as in `"tradução" [ench-5 | exact English]`. The English is
 * what gets verified; the translation is then shown, marked as a translation.
 *
 * Other text in quotation marks (a word, the visitor's own phrase) is ordinary
 * prose unless it happens to match a passage word for word.
 */

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "citation"; id: string }
  | {
      kind: "quote";
      /** The words shown: the original, or a translation of it. */
      text: string;
      /** The English original given with a translated quotation. */
      original?: string;
      /** Passage the (original) words were found in, or null if they were not found. */
      verifiedIn: string | null;
    };

// Passage id prefixes of the three corpora (see scripts/build-corpus.ts).
const ID = String.raw`(?:ench|disc|gs|frag|med|ep|dial|clem|ben)-\d+(?:\.\d+)*`;
// One or more ids, optionally followed by "| English original" for a translated quotation.
const CITATION_BODY = String.raw`(${ID}(?:\s*[,;]\s*${ID})*)(?:\s*\|\s*([^\]\n]*))?`;
const CITATION = new RegExp(String.raw`\[${CITATION_BODY}\]`, "g");
// Double quotation marks as used in English, French («»), Croatian and German („“), at least a few characters long.
const QUOTE = /[“"«„]([^“”"«»„\n]{12,}?)[”"»“]/g;
// A quotation counts as attributed when a citation follows right after it.
const ATTRIBUTED = new RegExp(String.raw`^[\s,.;:!?—–-]{0,3}\[${CITATION_BODY}\]`);
const HAS_CITATION = new RegExp(String.raw`\[${ID}`);

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findQuoteSource(
  quote: string,
  passages: ReadonlyArray<{ id: string; text: string }>,
): string | null {
  // An ellipsis marks an omission: each remaining part must appear, in order.
  const parts = quote
    .split(/\.\.\.|…/)
    .map(normalizeForMatch)
    .filter(Boolean);
  if (parts.join(" ").split(" ").length < 3) return null;
  for (const p of passages) {
    const haystack = normalizeForMatch(p.text);
    let from = 0;
    const allFound = parts.every((part) => {
      const at = haystack.indexOf(part, from);
      if (at === -1) return false;
      from = at + part.length;
      return true;
    });
    if (allFound) return p.id;
  }
  return null;
}

export function segmentReply(
  reply: string,
  passages: ReadonlyArray<{ id: string; text: string }>,
): Segment[] {
  const segments: Segment[] = [];

  const pushText = (text: string) => {
    if (!text) return;
    const last = segments.at(-1);
    if (last?.kind === "text") last.text += text;
    else segments.push({ kind: "text", text });
  };

  // Quotations are found across the whole reply first, so a citation after the closing mark can be seen.
  let pos = 0;
  const pieces: Array<{ kind: "plain"; text: string } | { kind: "quote"; raw: string; text: string }> = [];
  for (const m of reply.matchAll(QUOTE)) {
    // Never treat a citation marker as part of a quotation.
    if (HAS_CITATION.test(m[1])) continue;
    if (m.index > pos) pieces.push({ kind: "plain", text: reply.slice(pos, m.index) });
    pieces.push({ kind: "quote", raw: m[0], text: m[1] });
    pos = m.index + m[0].length;
  }
  if (pos < reply.length) pieces.push({ kind: "plain", text: reply.slice(pos) });

  const pushPlain = (text: string) => {
    let last = 0;
    for (const m of text.matchAll(CITATION)) {
      pushText(text.slice(last, m.index));
      for (const id of m[1].split(/[,;]/)) segments.push({ kind: "citation", id: id.trim() });
      last = m.index + m[0].length;
    }
    pushText(text.slice(last));
  };

  pieces.forEach((piece, i) => {
    if (piece.kind === "plain") return pushPlain(piece.text);
    const next = pieces[i + 1];
    const citation = next?.kind === "plain" ? next.text.match(ATTRIBUTED) : null;
    const original = citation?.[2]?.trim();
    // English words in the translated form ("same words" [id | same words]) are the original, not a translation.
    const literal = original ? findQuoteSource(piece.text, passages) : null;
    if (original && !literal) {
      // Verify the English original, preferably in the passage it cites.
      const citedFirst = [...passages].sort((a, b) => Number(b.id === citation![1].trim()) - Number(a.id === citation![1].trim()));
      segments.push({ kind: "quote", text: piece.text.trim(), original, verifiedIn: findQuoteSource(original, citedFirst) });
      return;
    }
    const verifiedIn = findQuoteSource(piece.text, passages);
    if (verifiedIn || citation) segments.push({ kind: "quote", text: piece.text.trim(), verifiedIn });
    else pushText(piece.raw);
  });
  return segments;
}

/** Passage ids cited in a reply, in order of first appearance. */
export function citedIds(reply: string): string[] {
  const ids: string[] = [];
  for (const m of reply.matchAll(CITATION)) {
    for (const id of m[1].split(/[,;]/)) {
      const clean = id.trim();
      if (!ids.includes(clean)) ids.push(clean);
    }
  }
  return ids;
}
