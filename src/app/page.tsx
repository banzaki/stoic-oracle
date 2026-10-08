import Link from "next/link";
import { Medallion } from "@/components/Medallion";
import { PHILOSOPHERS, type Philosopher } from "@/lib/philosophers";

function PhilosopherCard({ philosopher, index }: { philosopher: Philosopher; index: number }) {
  const { available } = philosopher;
  const body = (
    <>
      <div className="flex justify-center">
        <Medallion monogram={philosopher.monogram} size={112} dim={!available} />
      </div>
      <p className="mt-6 text-center font-serif text-sm tracking-wide text-stone">{philosopher.nativeName}</p>
      <h2
        className={`mt-1 text-center font-display text-4xl font-medium ${available ? "text-parchment" : "text-stone"}`}
      >
        {philosopher.name}
      </h2>
      <p className="mt-2 text-center text-xs uppercase tracking-[0.2em] text-dust">
        {philosopher.lifespan} · {philosopher.role}
      </p>
      <div className="ornament my-6 text-[10px]">◆</div>
      <blockquote className="flex-1 text-center">
        <p className={`font-serif text-lg italic leading-snug ${available ? "text-parchment/90" : "text-stone/80"}`}>
          “{philosopher.epigraph.text}”
        </p>
        <footer className="mt-3 text-xs text-dust">{philosopher.epigraph.ref}</footer>
      </blockquote>
      <div className="mt-8 text-center">
        {available ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold/10 px-5 py-2 text-sm font-medium text-gold-bright transition group-hover:border-gold group-hover:bg-gold/20">
            Enter the school
            <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
              →
            </span>
          </span>
        ) : (
          <span className="inline-block rounded-full border border-dust/40 px-5 py-2 text-sm text-dust">
            In preparation
          </span>
        )}
      </div>
    </>
  );

  const shared = `animate-rise flex h-full flex-col rounded-2xl border p-8`;
  const style = { animationDelay: `${120 + index * 120}ms` };

  if (available && philosopher.href) {
    return (
      <Link
        href={philosopher.href}
        style={style}
        className={`${shared} group border-gold/30 bg-gradient-to-b from-ash/80 to-umber/60 shadow-[0_0_60px_-20px_rgba(201,169,110,0.35)] transition hover:-translate-y-1 hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold`}
      >
        {body}
      </Link>
    );
  }
  return (
    <div style={style} className={`${shared} border-white/5 bg-umber/40`} aria-disabled="true">
      {body}
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-16 pt-10 sm:px-8">
      <header className="animate-rise flex items-center justify-center">
        <p className="text-xs uppercase tracking-[0.45em] text-gold">Stoic Oracle</p>
      </header>

      <section className="mx-auto mt-14 max-w-3xl text-center sm:mt-20">
        <h1 className="animate-rise font-display text-5xl font-medium leading-[1.05] text-parchment sm:text-7xl">
          Converse with the Stoics
        </h1>
        <p
          className="animate-rise mx-auto mt-6 max-w-xl font-serif text-lg leading-relaxed text-stone sm:text-xl"
          style={{ animationDelay: "80ms" }}
        >
          Three voices from the Stoa, brought back from their own writings. They will listen, question you, and
          disagree when you are wrong — and every quotation is traced to the page it came from.
        </p>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-3 md:items-stretch">
        {PHILOSOPHERS.map((p, i) => (
          <PhilosopherCard key={p.id} philosopher={p} index={i} />
        ))}
      </section>

      <footer className="mt-auto pt-16 text-center text-xs leading-relaxed text-dust">
        <p>
          The philosophers are AI portrayals — roughly 70% historical record, 30% respectful imagination.
        </p>
        <p className="mt-1">
          Sources: public-domain translations from Project Gutenberg and Wikisource.
        </p>
      </footer>
    </main>
  );
}
