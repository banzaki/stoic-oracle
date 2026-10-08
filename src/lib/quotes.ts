/**
 * Splits a philosopher's reply into renderable segments and checks every
 * quotation against the verbatim library passages it was given.
 *
 * A quotation counts as authentic only if its words appear, in order, inside
 * one of the passages. Anything else is shown as unverified paraphrase.
 */

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "citation"; id: string }
  | { kind: "quote"; text: string; verifiedIn: string | null };

const CITATION = /\[((?:ench|disc|gs|frag)-[\d.]+(?:\s*,\s*(?:ench|disc|gs|frag)-[\d.]+)*)\]/g;
// Straight or curly double quotes, at least a few words long.
const QUOTE = /[“"]([^“”"\n]{12,}?)[”"]/g;

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
    let last = 0;
    for (const m of text.matchAll(QUOTE)) {
      if (m.index > last) segments.push({ kind: "text", text: text.slice(last, m.index) });
      segments.push({ kind: "quote", text: m[1], verifiedIn: findQuoteSource(m[1], passages) });
      last = m.index + m[0].length;
    }
    if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  };

  let last = 0;
  for (const m of reply.matchAll(CITATION)) {
    pushText(reply.slice(last, m.index));
    for (const id of m[1].split(",")) segments.push({ kind: "citation", id: id.trim() });
    last = m.index + m[0].length;
  }
  pushText(reply.slice(last));
  return segments;
}

/** Passage ids cited in a reply, in order of first appearance. */
export function citedIds(reply: string): string[] {
  const ids: string[] = [];
  for (const m of reply.matchAll(CITATION)) {
    for (const id of m[1].split(",")) {
      const clean = id.trim();
      if (!ids.includes(clean)) ids.push(clean);
    }
  }
  return ids;
}
