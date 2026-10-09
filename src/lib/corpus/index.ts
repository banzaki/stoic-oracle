import "server-only";
import epictetusJson from "../../../data/corpus/epictetus.json";
import marcusJson from "../../../data/corpus/marcus-aurelius.json";
import senecaJson from "../../../data/corpus/seneca.json";
import type { PhilosopherId } from "../philosophers";
import type { Corpus, Passage, SourcePassage } from "./types";

export const CORPORA: Record<PhilosopherId, Corpus> = {
  epictetus: epictetusJson as Corpus,
  "marcus-aurelius": marcusJson as Corpus,
  seneca: senecaJson as Corpus,
};

const works = new Map(Object.values(CORPORA).flatMap((c) => c.works.map((w) => [w.id, w] as const)));

export function toSourcePassage(passage: Passage): SourcePassage {
  const work = works.get(passage.workId);
  if (!work) throw new Error(`Unknown work ${passage.workId}`);
  return {
    id: passage.id,
    ref: passage.ref,
    work: work.title,
    translator: work.translator,
    source: work.source,
    sourceUrl: work.sourceUrl,
    note: work.note,
    text: passage.text,
  };
}
