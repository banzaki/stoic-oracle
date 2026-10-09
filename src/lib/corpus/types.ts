import type { PhilosopherId } from "../philosophers";

export interface Work {
  id: string;
  title: string;
  translator: string;
  source: string;
  sourceUrl: string;
  /** EPUB file in `library/` this work was extracted from. */
  libraryFile: string;
  note?: string;
}

export interface Passage {
  /** Stable id used for citations, e.g. "ench-5" or "disc-14.2". */
  id: string;
  workId: string;
  /** Human-readable, verifiable reference, e.g. "Enchiridion 5". */
  ref: string;
  heading?: string;
  /**
   * Retrieval keeps at most a few passages per group so results come from different places.
   * Defaults to the id before its first "." (e.g. "disc-14" for "disc-14.2").
   */
  group?: string;
  /** Verbatim text from the translation. */
  text: string;
}

export interface Corpus {
  author: PhilosopherId;
  works: Work[];
  passages: Passage[];
}

/** A passage as sent to the browser: verbatim text plus its citation metadata. */
export interface SourcePassage {
  id: string;
  ref: string;
  work: string;
  translator: string;
  /** Edition the text was taken from, e.g. "Project Gutenberg #10661". */
  source: string;
  sourceUrl: string;
  note?: string;
  text: string;
}
