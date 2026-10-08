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
  /** Verbatim text from the translation. */
  text: string;
}

export interface Corpus {
  author: string;
  works: Work[];
  passages: Passage[];
}

/** A passage as sent to the browser: verbatim text plus its citation metadata. */
export interface SourcePassage {
  id: string;
  ref: string;
  work: string;
  translator: string;
  sourceUrl: string;
  note?: string;
  text: string;
}
