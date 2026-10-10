import Link from "next/link";

/** Explains how authentic text, quotations and references are marked in replies. */
export function ReadingGuide({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-4 text-sm leading-relaxed text-stone sm:px-5">
      <ul className="space-y-1.5 rounded-xl border border-gold/15 bg-umber/90 p-4">
        <li>
          <span className="text-parchment">Plain text</span> is {name} as portrayed by an AI — an interpretation
          grounded in the recorded writings, not literal words.
        </li>
        <li>
          <span className="border-b border-gold/40 text-gold-bright">Gold quotations ✓</span> were checked word for
          word against the translations in the library.
        </li>
        <li>
          <span className="border-b border-dashed border-ember/50 text-parchment">Quotations marked ≈</span> were
          attributed to the library but not found there word for word — read them as paraphrase.
        </li>
        <li>
          In other languages, quotations are <span className="text-gold-bright">AI translations marked ✓ tr.</span>{" "}
          — the English original was checked word for word, and appears with its source.
        </li>
        <li>
          <span className="text-gold">Numbers</span> open the references under each reply, with the full passages.
          Open <em>About this source</em> on a passage for its translation and edition, or see all{" "}
          <Link href="/sources" className="text-gold underline decoration-gold/40 underline-offset-2 hover:text-gold-bright">
            Sources
          </Link>
          .
        </li>
      </ul>
    </div>
  );
}
