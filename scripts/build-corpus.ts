/**
 * Builds the searchable passage corpora from the EPUB files in `library/`.
 *
 * The EPUBs are opened read-only; nothing in `library/` is modified.
 * Output: `data/corpus/{epictetus,marcus-aurelius,seneca}.json`
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
  const [entry] = await readEpubFiles(epubName, match);
  if (!entry) throw new Error(`No entry matching ${match} in ${epubName}`);
  return entry.html;
}

/** All entries whose name matches, in archive order. */
async function readEpubFiles(epubName: string, match: RegExp): Promise<Array<{ name: string; html: string }>> {
  const buffer = await readFile(path.join(LIBRARY, epubName));
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files).filter((f) => match.test(f.name));
  return Promise.all(entries.map(async (f) => ({ name: f.name, html: await f.async("string") })));
}

/** The <body> of an XHTML entry, so the <head> title is not read as text when entries are joined. */
function bodyOf(html: string): string {
  const start = html.search(/<body[\s>]/i);
  return start === -1 ? html : html.slice(start);
}

function toRoman(n: number): string {
  const table: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [value, letters] of table) {
    while (n >= value) {
      out += letters;
      n -= value;
    }
  }
  return out;
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

// ---------- Epictetus ----------

const DISCOURSES_EPUB = "A Selection from the Discourses of Epictetus with the Encheiridion.epub";
const GOLDEN_EPUB = "The Golden Sayings of Epictetus, with the Hymn of Cleanthes by Epictetus.epub";

const epictetusWorks: Work[] = [
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

// ---------- Marcus Aurelius ----------

const MARCUS_EPUB = "Thoughts of Marcus Aurelius Antoninus by Emperor of Rome Marcus Aurelius.epub";

const marcusWorks: Work[] = [
  {
    id: "meditations",
    title: "Meditations",
    translator: "George Long",
    source: "Project Gutenberg #15877 (The Thoughts of the Emperor M. Aurelius Antoninus)",
    sourceUrl: "https://www.gutenberg.org/ebooks/15877",
    libraryFile: MARCUS_EPUB,
  },
];

/** Splits HTML on <h2> headings, returning [headingText, bodyHtml] pairs. */
function splitOnH2(html: string): Array<[string, string]> {
  const parts = html.split(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const out: Array<[string, string]> = [];
  for (let i = 1; i < parts.length; i += 2) {
    out.push([parse(parts[i]).text.replace(/\s+/g, " ").trim(), parts[i + 1] ?? ""]);
  }
  return out;
}

/** Long's Meditations: twelve books, each a run of numbered sections ("2. From ..."). */
async function extractMeditations(): Promise<Passage[]> {
  const files = await readEpubFiles(MARCUS_EPUB, /h-[123]\.htm\.xhtml$/);
  const html = files
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => bodyOf(f.html))
    .join("\n")
    .replace(/<div class="footnote">[\s\S]*?<\/div>/gi, "") // Long's notes are not Marcus' words
    .replace(/<p class="caption">[\s\S]*?<\/p>/gi, "") // illustration captions
    .replace(/<a[^>]*class="fnanchor[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "");

  const passages: Passage[] = [];
  for (const [heading, bodyHtml] of splitOnH2(html)) {
    const bookMatch = heading.match(/^([IVX]+)\.$/);
    if (!bookMatch) continue;
    const book = romanToInt(bookMatch[1]);

    const sections: Array<{ n: number; paragraphs: string[] }> = [];
    let current = { n: 1, paragraphs: [] as string[] };
    for (const para of htmlToParagraphs(bodyHtml)) {
      // The next section number usually opens a paragraph, but where Long sets short
      // verse quotations with line breaks it can also fall mid-paragraph.
      let rest = para;
      for (;;) {
        const next = rest.match(new RegExp(`(^|\\s)${current.n + 1}\\.\\s+`));
        if (!next) break;
        const before = rest.slice(0, next.index).trim();
        if (before) current.paragraphs.push(before);
        sections.push(current);
        current = { n: current.n + 1, paragraphs: [] };
        rest = rest.slice(next.index! + next[0].length);
      }
      if (rest.trim()) current.paragraphs.push(rest.trim());
    }
    sections.push(current);

    for (const section of sections) {
      if (!section.paragraphs.length) continue;
      const chunks = chunkParagraphs(section.paragraphs);
      chunks.forEach((chunk, ci) => {
        passages.push({
          id: `med-${book}.${section.n}${chunks.length > 1 ? `.${ci + 1}` : ""}`,
          workId: "meditations",
          ref: `Meditations ${toRoman(book)}.${section.n}${paraLabel(chunk, chunks.length)}`,
          group: `med-${book}.${section.n}`,
          text: chunk.text,
        });
      });
    }
  }
  return passages;
}

// ---------- Seneca ----------

const LETTERS_EPUB = "Moral_letters_to_Lucilius - Seneca.epub";
const DIALOGUES_EPUB = "Minor Dialogues, Together With the Dialogue on Clemency by Lucius Annaeus Seneca.epub";
const BENEFITS_EPUB = "L. Annaeus Seneca on Benefits by Lucius Annaeus Seneca.epub";

const senecaWorks: Work[] = [
  {
    id: "letters",
    title: "Moral Letters to Lucilius",
    translator: "Richard M. Gummere",
    source: "Wikisource (Loeb Classical Library, 1917–1925)",
    sourceUrl: "https://en.wikisource.org/wiki/Moral_letters_to_Lucilius",
    libraryFile: LETTERS_EPUB,
  },
  {
    id: "dialogues",
    title: "Dialogues",
    translator: "Aubrey Stewart",
    source: "Project Gutenberg #64576 (Minor Dialogues)",
    sourceUrl: "https://www.gutenberg.org/ebooks/64576",
    libraryFile: DIALOGUES_EPUB,
  },
  {
    id: "clemency",
    title: "On Clemency",
    translator: "Aubrey Stewart",
    source: "Project Gutenberg #64576 (Minor Dialogues)",
    sourceUrl: "https://www.gutenberg.org/ebooks/64576",
    libraryFile: DIALOGUES_EPUB,
  },
  {
    id: "benefits",
    title: "On Benefits",
    translator: "Aubrey Stewart",
    source: "Project Gutenberg #3794",
    sourceUrl: "https://www.gutenberg.org/ebooks/3794",
    libraryFile: BENEFITS_EPUB,
  },
];

const SECTION_MARK = "\u0003";
const SECTION_SPLIT = /\u0003(\d+)\u0003/;

/** Gummere's letters: one EPUB entry per letter, sections marked with bold superscript numbers. */
async function extractLetters(): Promise<Passage[]> {
  const files = await readEpubFiles(LETTERS_EPUB, /_Letter_\d+\.xhtml$/);
  const passages: Passage[] = [];

  for (const file of files) {
    const letter = Number(file.name.match(/_Letter_(\d+)\.xhtml$/)![1]);
    let html = file.html.slice(file.html.indexOf("<body"));
    const notesAt = html.search(/<hr[^>]*wst-rule|<div[^>]*class="reflist/);
    if (notesAt !== -1) html = html.slice(0, notesAt); // Gummere's footnotes follow the rule
    html = html
      .replace(/<a[^>]*epub:type="noteref"[^>]*>[\s\S]*?<\/a>/gi, "")
      .replace(/<sup>\s*<b>(\d+)\.<\/b>\s*<\/sup>/gi, ` ${SECTION_MARK}$1${SECTION_MARK} `);

    const titleMatch = html.match(/<p>\s*([IVXLC]+)\.\s+([^<]+?)\s*<\/p>/);
    if (titleMatch && romanToInt(titleMatch[1]) !== letter) {
      throw new Error(`Letter ${letter} has heading ${titleMatch[1]}`);
    }
    const title = titleMatch ? titleCase(titleMatch[2]) : undefined;

    const paragraphs = htmlToParagraphs(html);
    const first = paragraphs.findIndex((p) => p.includes(`${SECTION_MARK}1${SECTION_MARK}`));
    if (first === -1) throw new Error(`Letter ${letter} has no section 1`);
    paragraphs[first] = paragraphs[first].slice(paragraphs[first].indexOf(SECTION_MARK));

    // Split into numbered sections, keeping paragraph breaks inside a section.
    const sections: Array<{ n: number; text: string }> = [];
    for (const para of paragraphs.slice(first)) {
      const parts = para.split(SECTION_SPLIT);
      if (parts[0].trim() && sections.length) sections.at(-1)!.text += `\n\n${parts[0].trim()}`;
      for (let i = 1; i < parts.length; i += 2) sections.push({ n: Number(parts[i]), text: parts[i + 1].trim() });
    }

    // Group consecutive sections into passages of bounded size.
    const chunks: Array<{ from: number; to: number; text: string }> = [];
    for (const section of sections) {
      if (!section.text) continue;
      const last = chunks.at(-1);
      if (last && last.text.length + section.text.length < MAX_CHUNK_CHARS) {
        last.to = section.n;
        last.text += ` ${section.text}`;
      } else {
        for (const piece of splitLongParagraph(section.text)) chunks.push({ from: section.n, to: section.n, text: piece });
      }
    }

    chunks.forEach((chunk, ci) => {
      passages.push({
        id: `ep-${letter}.${ci + 1}`,
        workId: "letters",
        ref: `Moral Letters ${letter}.${chunk.from}${chunk.to > chunk.from ? `–${chunk.to}` : ""}`,
        heading: title,
        group: `ep-${letter}`,
        text: chunk.text,
      });
    });
  }
  return passages.sort((a, b) => idOrder(a.id) - idOrder(b.id));
}

function idOrder(id: string): number {
  const [major, minor = "0"] = id.replace(/^[a-z]+-/, "").split(".");
  return Number(major) * 1000 + Number(minor);
}

const DIALOGUE_TITLES = [
  "On Providence",
  "On the Firmness of the Wise Man",
  "On Anger, Book I",
  "On Anger, Book II",
  "On Anger, Book III",
  "To Marcia, On Consolation",
  "On the Happy Life",
  "On Leisure",
  "On Peace of Mind",
  "On the Shortness of Life",
  "To Helvia, On Consolation",
  "To Polybius, On Consolation",
];

/**
 * Splits a book into chapters introduced by sequential Roman numerals ("I. You have asked me...").
 * Paragraphs before the first numeral, if any, belong to chapter 1.
 */
function splitRomanChapters(paragraphs: string[]): Array<{ n: number; paragraphs: string[] }> {
  const chapters: Array<{ n: number; paragraphs: string[] }> = [];
  let current = { n: 1, paragraphs: [] as string[] };
  for (const para of paragraphs) {
    const m = para.match(/^([IVXLC]+)\.\s+/);
    const n = m ? romanToInt(m[1]) : 0;
    if (m && n === 1 && !current.paragraphs.length) {
      current.paragraphs.push(para.slice(m[0].length));
    } else if (m && n === current.n + 1) {
      chapters.push(current);
      current = { n, paragraphs: [para.slice(m[0].length)] };
    } else {
      current.paragraphs.push(para);
    }
  }
  chapters.push(current);
  return chapters.filter((c) => c.paragraphs.length);
}

/** Stewart's Minor Dialogues and On Clemency: one <h2> per book, chapters by Roman numeral. */
async function extractDialogues(): Promise<Passage[]> {
  const files = await readEpubFiles(DIALOGUES_EPUB, /h-[1-5]\.htm\.xhtml$/);
  const html = files
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => bodyOf(f.html))
    .join("\n")
    .replace(/<div class="footnote">[\s\S]*?<\/div>/gi, "") // Stewart's notes are not Seneca's words
    .replace(/<p class="footnote">[\s\S]*?<\/p>/gi, "")
    .replace(/<a[^>]*id="fnref-[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "");

  const passages: Passage[] = [];
  let dialogue = 0;
  let clemencyBook = 0;
  for (const [heading, bodyHtml] of splitOnH2(html)) {
    if (!/BOOK OF THE DIALOGUE/i.test(heading)) continue;
    const isClemency = /CLEMENCY/i.test(heading);
    const book = isClemency ? ++clemencyBook : ++dialogue;
    const title = isClemency ? `On Clemency, Book ${toRoman(book)}` : DIALOGUE_TITLES[book - 1];
    const prefix = isClemency ? `clem-${book}` : `dial-${book}`;

    for (const chapter of splitRomanChapters(htmlToParagraphs(bodyHtml))) {
      const chunks = chunkParagraphs(chapter.paragraphs);
      chunks.forEach((chunk, ci) => {
        passages.push({
          id: `${prefix}.${chapter.n}${chunks.length > 1 ? `.${ci + 1}` : ""}`,
          workId: isClemency ? "clemency" : "dialogues",
          ref: `${title}, ch. ${chapter.n}${paraLabel(chunk, chunks.length)}`,
          heading: title,
          group: `${prefix}.${chapter.n}`,
          text: chunk.text,
        });
      });
    }
  }
  if (dialogue !== DIALOGUE_TITLES.length || clemencyBook !== 2) {
    throw new Error(`Expected 12 dialogues and 2 books of On Clemency, found ${dialogue} and ${clemencyBook}`);
  }
  return passages;
}

/** Stewart's On Benefits: <h2> per book, chapters by Roman numeral (only chapter I has an <h3>). */
async function extractBenefits(): Promise<Passage[]> {
  const files = await readEpubFiles(BENEFITS_EPUB, /h-[012]\.htm\.xhtml$/);
  const html = files
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => bodyOf(f.html))
    .join("\n");

  const passages: Passage[] = [];
  for (const [heading, bookHtml] of splitOnH2(html)) {
    const bookMatch = heading.match(/^BOOK ([IVX]+)\.?$/);
    if (!bookMatch) continue;
    const book = romanToInt(bookMatch[1]);
    const paragraphs = htmlToParagraphs(bookHtml.replace(/<h3[^>]*>[\s\S]*?<\/h3>/gi, ""));
    for (const chapter of splitRomanChapters(paragraphs)) {
      const chunks = chunkParagraphs(chapter.paragraphs);
      chunks.forEach((chunk, ci) => {
        passages.push({
          id: `ben-${book}.${chapter.n}${chunks.length > 1 ? `.${ci + 1}` : ""}`,
          workId: "benefits",
          ref: `On Benefits ${toRoman(book)}.${chapter.n}${paraLabel(chunk, chunks.length)}`,
          group: `ben-${book}.${chapter.n}`,
          text: chunk.text,
        });
      });
    }
  }
  return passages;
}

// ---------- main ----------

async function writeCorpus(corpus: Corpus) {
  const ids = new Set<string>();
  for (const p of corpus.passages) {
    if (ids.has(p.id)) throw new Error(`Duplicate passage id: ${p.id}`);
    ids.add(p.id);
    if (/Footnote|\u0003|\[\d+\]/.test(p.text)) throw new Error(`Unclean text in ${p.id}: ${p.text.slice(0, 160)}`);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const file = `${corpus.author}.json`;
  await writeFile(path.join(OUT_DIR, file), JSON.stringify(corpus, null, 1));

  const byWork = new Map<string, number>();
  for (const p of corpus.passages) byWork.set(p.workId, (byWork.get(p.workId) ?? 0) + 1);
  console.log(`Wrote ${corpus.passages.length} passages to data/corpus/${file}`);
  for (const [work, count] of byWork) console.log(`  ${work}: ${count}`);
}

async function main() {
  await writeCorpus({
    author: "epictetus",
    works: epictetusWorks,
    passages: [...(await extractEnchiridion()), ...(await extractDiscourses()), ...(await extractGoldenSayings())],
  });
  await writeCorpus({
    author: "marcus-aurelius",
    works: marcusWorks,
    passages: await extractMeditations(),
  });
  await writeCorpus({
    author: "seneca",
    works: senecaWorks,
    passages: [...(await extractLetters()), ...(await extractDialogues()), ...(await extractBenefits())],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
