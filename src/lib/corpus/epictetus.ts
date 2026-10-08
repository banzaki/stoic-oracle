import "server-only";
import corpusJson from "../../../data/corpus/epictetus.json";
import type { Corpus, Passage, SourcePassage } from "./types";

export const epictetusCorpus = corpusJson as Corpus;

const worksById = new Map(epictetusCorpus.works.map((w) => [w.id, w]));

export function toSourcePassage(passage: Passage): SourcePassage {
  const work = worksById.get(passage.workId);
  if (!work) throw new Error(`Unknown work ${passage.workId}`);
  return {
    id: passage.id,
    ref: passage.ref,
    work: work.title,
    translator: work.translator,
    sourceUrl: work.sourceUrl,
    note: work.note,
    text: passage.text,
  };
}
