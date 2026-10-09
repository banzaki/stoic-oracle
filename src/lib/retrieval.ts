import type { Corpus, Passage } from "./corpus/types";

/**
 * Lexical passage retrieval (Okapi BM25) over a single author's corpus.
 *
 * The translations use 19th-century English ("thou", "wouldst", "perturbation"),
 * so the query is lightly expanded from modern words to the vocabulary the
 * translators actually used before scoring.
 */

const STOPWORDS = new Set(
  `a about above after again against all am an and any are as at be because been before being below between both but by can
  could did do does doing down during each few for from further had has have having he her here hers herself him himself his
  how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves
  out over own same she should so some such than that the their theirs them themselves then there these they this those through
  to too under until up very was we were what when where which while who whom why will with would you your yours yourself
  yourselves thou thee thy thine ye hath doth art wilt shalt unto upon also shall may might must let one man men say said says
  saith thing things like even yet way well get got much many make made us therefore indeed whether either neither else`.split(/\s+/),
);

/** Modern words → terms the translators used. Kept small and conservative. */
const EXPANSIONS: Record<string, string[]> = {
  anxiety: ["fear", "disturbed", "perturbation", "tranquillity"],
  anxious: ["fear", "disturbed", "perturbation", "tranquillity"],
  stress: ["disturbed", "perturbation", "tranquillity"],
  stressed: ["disturbed", "perturbation", "tranquillity"],
  worry: ["fear", "disturbed", "anxious"],
  worried: ["fear", "disturbed", "anxious"],
  depressed: ["grief", "sorrow", "lament"],
  depression: ["grief", "sorrow", "lament"],
  sad: ["grief", "sorrow", "lament"],
  sadness: ["grief", "sorrow", "lament"],
  happy: ["happiness", "content", "tranquillity"],
  happiness: ["happy", "content", "tranquillity", "free"],
  control: ["power", "will"],
  job: ["office", "work", "employment"],
  career: ["office", "honour", "employment"],
  boss: ["master", "tyrant", "powerful"],
  money: ["wealth", "property", "poverty"],
  rich: ["wealth", "property"],
  poor: ["poverty", "want"],
  angry: ["anger", "angry", "rage"],
  anger: ["angry", "rage"],
  insult: ["insult", "abuse", "reviles", "reproach"],
  insulted: ["insult", "abuse", "reviles", "reproach"],
  criticism: ["blame", "reproach", "censure"],
  criticized: ["blame", "reproach", "censure"],
  reputation: ["opinion", "esteem", "praise", "honour"],
  fame: ["praise", "esteem", "admired"],
  social: ["opinion", "esteem", "admired", "praise"],
  media: ["opinion", "esteem", "admired", "praise"],
  breakup: ["loss", "friend", "affection"],
  divorce: ["wife", "loss"],
  partner: ["wife", "friend"],
  girlfriend: ["wife", "friend", "affection"],
  boyfriend: ["friend", "affection"],
  kid: ["child", "children"],
  kids: ["child", "children"],
  parents: ["father", "mother"],
  dying: ["death", "die"],
  died: ["death", "dead", "die"],
  grief: ["grief", "sorrow", "lament", "death"],
  sick: ["sickness", "disease", "fever"],
  illness: ["sickness", "disease", "fever"],
  fail: ["failure", "fault", "hindered"],
  failure: ["fault", "hindered", "progress"],
  procrastinate: ["delay", "progress", "neglect"],
  procrastination: ["delay", "progress", "neglect"],
  addiction: ["desire", "habit", "pleasure"],
  phone: ["desire", "habit", "pleasure"],
  lonely: ["solitude", "alone", "solitary"],
  loneliness: ["solitude", "alone", "solitary"],
  purpose: ["nature", "duty", "end"],
  meaning: ["nature", "duty", "end"],
  god: ["god", "zeus", "providence"],
  religion: ["god", "gods", "providence"],
  freedom: ["free", "freedom", "slave"],
  free: ["freedom", "slave"],
  emotions: ["passion", "perturbation", "desire", "aversion"],
  feelings: ["passion", "perturbation", "desire", "aversion"],
  overthinking: ["appearances", "opinion", "judgment"],
  perception: ["appearances", "opinion", "judgment"],
  judge: ["judgment", "opinion"],
  wrong: ["error", "fault"],
};

function stem(word: string): string {
  if (word.length <= 4) return word;
  return word
    .replace(/(ings|ing|edst|eth|est|ed|ies|es|s|ly)$/, (m) => (m === "ies" ? "y" : ""))
    .replace(/(.)\1$/, "$1");
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").match(/[a-z]+/g) ?? [])
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
}

function expandQuery(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const extra = words.flatMap((w) => EXPANSIONS[w] ?? []);
  return [...tokenize(text), ...tokenize(extra.join(" "))];
}

interface Index {
  passages: Passage[];
  termFreqs: Map<string, number>[];
  lengths: number[];
  avgLength: number;
  docFreq: Map<string, number>;
}

const K1 = 1.4;
const B = 0.6;

function buildIndex(corpus: Corpus): Index {
  const termFreqs: Map<string, number>[] = [];
  const lengths: number[] = [];
  const docFreq = new Map<string, number>();
  for (const p of corpus.passages) {
    const tokens = tokenize(`${p.heading ?? ""} ${p.text}`);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    termFreqs.push(tf);
    lengths.push(tokens.length);
  }
  const avgLength = lengths.reduce((a, b) => a + b, 0) / Math.max(lengths.length, 1);
  return { passages: corpus.passages, termFreqs, lengths, avgLength, docFreq };
}

const indexCache = new WeakMap<Corpus, Index>();

export interface SearchOptions {
  limit?: number;
  /** Maximum passages returned from the same section (e.g. one Discourse). */
  perSection?: number;
}

export function searchPassages(corpus: Corpus, query: string, options: SearchOptions = {}): Passage[] {
  const { limit = 8, perSection = 2 } = options;
  let index = indexCache.get(corpus);
  if (!index) {
    index = buildIndex(corpus);
    indexCache.set(corpus, index);
  }

  const queryTerms = new Map<string, number>();
  for (const t of expandQuery(query)) queryTerms.set(t, (queryTerms.get(t) ?? 0) + 1);
  if (!queryTerms.size) return [];

  const N = index.passages.length;
  const scored: Array<{ i: number; score: number }> = [];
  index.termFreqs.forEach((tf, i) => {
    let score = 0;
    for (const [term, qf] of queryTerms) {
      const f = tf.get(term);
      if (!f) continue;
      const df = index.docFreq.get(term) ?? 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const norm = f + K1 * (1 - B + (B * index.lengths[i]) / index.avgLength);
      score += idf * ((f * (K1 + 1)) / norm) * Math.min(qf, 2);
    }
    if (score > 0) scored.push({ i, score });
  });
  scored.sort((a, b) => b.score - a.score);

  const results: Passage[] = [];
  const perSectionCount = new Map<string, number>();
  for (const { i } of scored) {
    const passage = index.passages[i];
    const section = passage.group ?? passage.id.split(".")[0];
    const count = perSectionCount.get(section) ?? 0;
    if (count >= perSection) continue;
    perSectionCount.set(section, count + 1);
    results.push(passage);
    if (results.length >= limit) break;
  }
  return results;
}
