/**
 * Builds the searchable passage corpus from the EPUB files in `library/`.
 *
 * The EPUBs are opened read-only; nothing in `library/` is modified.
 * Output: `data/corpus/epictetus.json`
 *
 * Run with: npm run corpus
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { parse } from "node-html-parser";
import type { Corpus, Passage, Work } from "../src/lib/corpus/types";

const ROOT = process.cwd();
const LIBRARY = path.join(ROOT, "library");
const OUT_DIR = path.join(ROOT, "data", "corpus");

const PARA = "\u0001";
const MAX_CHUNK_CHARS = 1400;

// ---------- helpers ----------

async function readEpubFile(epubName: string, match: RegExp): Promise<string> {
  const buffer = await readFile(path.join(LIBRARY, epubName));
  const zip = await JSZip.loadAsync(buffer);
  const entry = Object.values(zip.files).find((f) => match.test(f.name));
  if (!entry) throw new Error(`No entry matching ${match} in ${epubName}`);
  return entry.async("string");
}

/** Converts an HTML fragment into clean plain-text paragraphs. */
function htmlToParagraphs(html: string): string[] {
  const marked = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(p|div|blockquote|h[1-6]|li|tr)[^>]*>/gi, PARA)
    .replace(/<hr[^>]*>/gi, PARA);
  return parse(`<div>${marked}</div>`)
    .text.split(PARA)
    .map((p) =>
      p
        .replace(/\[Footnote:[^\]]*\]/g, "") // translator notes are not the author's words
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((p) => p.length > 0);
}

function romanToInt(roman: string): number {
  const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const s = roman.toUpperCase().replace(/[^IVXLCDM]/g, "");
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = values[s[i]];
    const next = values[s[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

/** Splits an over-long paragraph at sentence boundaries. */
function splitLongParagraph(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const sentences = text.match(/[^.?!]+[.?!]+["”’)]*\s*|[^.?!]+$/g) ?? [text];
  const pieces: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > MAX_CHUNK_CHARS) {
      pieces.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces;
}

interface Chunk {
  text: string;
  paraStart: number;
  paraEnd: number;
}

/** Groups paragraphs into chunks of bounded size, remembering paragraph numbers (1-based). */
function chunkParagraphs(paragraphs: string[]): Chunk[] {
  const chunks: Chunk[] = [];
  let buf: string[] = [];
  let start = 1;
  paragraphs.forEach((para, i) => {
    const n = i + 1;
    const pieces = splitLongParagraph(para);
    if (pieces.length > 1) {
      if (buf.length) chunks.push({ text: buf.join("\n\n"), paraStart: start, paraEnd: n - 1 });
      buf = [];
      for (const piece of pieces) chunks.push({ text: piece, paraStart: n, paraEnd: n });
      start = n + 1;
      return;
    }
    const size = buf.join("\n\n").length;
    if (buf.length && size + para.length > MAX_CHUNK_CHARS) {
      chunks.push({ text: buf.join("\n\n"), paraStart: start, paraEnd: n - 1 });
      buf = [];
      start = n;
    }
    if (!buf.length) start = n;
    buf.push(para);
  });
  if (buf.length) chunks.push({ text: buf.join("\n\n"), paraStart: start, paraEnd: paragraphs.length });
  return chunks;
}

function paraLabel(c: Chunk, chunkCount: number): string {
  if (chunkCount <= 1) return "";
  return c.paraStart === c.paraEnd ? `, ¶${c.paraStart}` : `, ¶${c.paraStart}–${c.paraEnd}`;
}

function titleCase(s: string): string {
  // Bracketed translator glosses such as "[Greek: phantasias]" keep their original casing.
  const glosses = s.match(/\[[^\]]*\]/g) ?? [];
  let i = 0;
  return titleCaseWords(s.replace(/\[[^\]]*\]/g, "\u0002")).replace(/\u0002/g, () => glosses[i++]);
}

function titleCaseWords(s: string): string {
  const small = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "who", "with", "that"]);
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// ---------- works ----------

const DISCOURSES_EPUB = "A Selection from the Discourses of Epictetus with the Encheiridion.epub";
const GOLDEN_EPUB = "The Golden Sayings of Epictetus, with the Hymn of Cleanthes by Epictetus.epub";

const works: Work[] = [
  {
    id: "discourses",
    title: "Discourses (selection)",
    translator: "George Long",
    source: "Project Gutenberg #10661",
    sourceUrl: "https://www.gutenberg.org/ebooks/10661",
    libraryFile: DISCOURSES_EPUB,
  },
  {
    id: "enchiridion",
    title: "Enchiridion",
    translator: "George Long",
    source: "Project Gutenberg #10661",
    sourceUrl: "https://www.gutenberg.org/ebooks/10661",
    libraryFile: DISCOURSES_EPUB,
  },
  {
    id: "golden-sayings",
    title: "The Golden Sayings of Epictetus",
    translator: "Hastings Crossley",
    source: "Project Gutenberg #871",
    sourceUrl: "https://www.gutenberg.org/ebooks/871",
    libraryFile: GOLDEN_EPUB,
  },
  {
    id: "fragments",
    title: "Fragments Attributed to Epictetus",
    translator: "Hastings Crossley",
    source: "Project Gutenberg #871 (Appendix A)",
    sourceUrl: "https://www.gutenberg.org/ebooks/871",
    libraryFile: GOLDEN_EPUB,
    note: "Attribution to Epictetus is traditional but not certain.",
  },
];

/** Discourses: sections separated by <hr/>, each opening with an upper-case title and a dash. */
async function extractDiscourses(): Promise<Passage[]> {
  const html = await readEpubFile(DISCOURSES_EPUB, /h-3\.htm\.xhtml$/);
  const body = html.slice(html.indexOf("</h2>") + 5);
  const sections = body.split(/<hr[^>]*>/i).map(htmlToParagraphs).filter((p) => p.length);
  const passages: Passage[] = [];

  sections.forEach((paragraphs, idx) => {
    const sectionNo = idx + 1;
    const titleMatch = paragraphs[0].match(/^((?:[^a-z[]|\[[^\]]*\]){6,}?)\s*[—-]\s*(?=[A-Z])/);
    if (!titleMatch) throw new Error(`Discourses section ${sectionNo} has no title: ${paragraphs[0].slice(0, 80)}`);
    const title = titleCase(titleMatch[1].replace(/\.$/, "").trim());
    paragraphs[0] = paragraphs[0].slice(titleMatch[0].length);

    const chunks = chunkParagraphs(paragraphs);
    chunks.forEach((chunk, ci) => {
      passages.push({
        id: `disc-${sectionNo}${chunks.length > 1 ? `.${ci + 1}` : ""}`,
        workId: "discourses",
        ref: `Discourses (sel.) §${sectionNo}, “${title}”${paraLabel(chunk, chunks.length)}`,
        heading: title,
        text: chunk.text,
      });
    });
  });
  return passages;
}

/** Splits HTML on <h3> headings, returning [headingText, bodyHtml] pairs. */
function splitOnH3(html: string): Array<[string, string]> {
  const parts = html.split(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  const out: Array<[string, string]> = [];
  for (let i = 1; i < parts.length; i += 2) {
    out.push([parse(parts[i]).text.replace(/\s+/g, " ").trim(), parts[i + 1] ?? ""]);
  }
  return out;
}

async function extractEnchiridion(): Promise<Passage[]> {
  const html = await readEpubFile(DISCOURSES_EPUB, /h-4\.htm\.xhtml$/);
  const passages: Passage[] = [];
  for (const [heading, bodyHtml] of splitOnH3(html)) {
    const chapter = romanToInt(heading);
    const paragraphs = htmlToParagraphs(bodyHtml);
    const chunks = chunkParagraphs(paragraphs);
    chunks.forEach((chunk, ci) => {
      passages.push({
        id: `ench-${chapter}${chunks.length > 1 ? `.${ci + 1}` : ""}`,
        workId: "enchiridion",
        ref: `Enchiridion ${chapter}${paraLabel(chunk, chunks.length)}`,
        text: chunk.text,
      });
    });
  }
  return passages;
}

async function extractGoldenSayings(): Promise<Passage[]> {
  const html = await readEpubFile(GOLDEN_EPUB, /h-0\.htm\.xhtml$/);
  const passages: Passage[] = [];
  let mode: "sayings" | "fragments" | "stop" = "sayings";

  for (const [heading, bodyHtml] of splitOnH3(html)) {
    if (/Fragments Attributed/i.test(heading)) {
      mode = "fragments";
      continue;
    }
    if (/Hymn of Cleanthes|APPENDIX B/i.test(heading)) {
      mode = "stop"; // Cleanthes' hymn is not by Epictetus
    }
    if (mode === "stop") break;
    if (!/^[IVXLC]+$/.test(heading)) continue; // e.g. "(APPENDIX A)"

    const n = romanToInt(heading);
    const paragraphs = htmlToParagraphs(bodyHtml);
    if (!paragraphs.length) continue;
    const chunks = chunkParagraphs(paragraphs);
    const isFrag = mode === "fragments";
    chunks.forEach((chunk, ci) => {
      passages.push({
        id: `${isFrag ? "frag" : "gs"}-${n}${chunks.length > 1 ? `.${ci + 1}` : ""}`,
        workId: isFrag ? "fragments" : "golden-sayings",
        ref: `${isFrag ? "Fragment" : "Golden Sayings"} ${n}${paraLabel(chunk, chunks.length)}`,
        text: chunk.text,
      });
    });
  }
  return passages;
}

// ---------- main ----------

async function main() {
  const passages = [
    ...(await extractEnchiridion()),
    ...(await extractDiscourses()),
    ...(await extractGoldenSayings()),
  ];

  const ids = new Set<string>();
  for (const p of passages) {
    if (ids.has(p.id)) throw new Error(`Duplicate passage id: ${p.id}`);
    ids.add(p.id);
  }

  const corpus: Corpus = { author: "epictetus", works, passages };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "epictetus.json"), JSON.stringify(corpus, null, 1));

  const byWork = new Map<string, number>();
  for (const p of passages) byWork.set(p.workId, (byWork.get(p.workId) ?? 0) + 1);
  console.log(`Wrote ${passages.length} passages to data/corpus/epictetus.json`);
  for (const [work, count] of byWork) console.log(`  ${work}: ${count}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
