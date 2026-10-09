import Image from "next/image";
import Link from "next/link";
import { LaurelDivider } from "@/components/Laurel";
import { PHILOSOPHERS, type Philosopher } from "@/lib/philosophers";

function PhilosopherCard({ philosopher, index }: { philosopher: Philosopher; index: number }) {
  return (
    <Link
      href={philosopher.href}
      style={{ animationDelay: `${120 + index * 120}ms` }}
      className="animate-rise group flex h-full flex-col overflow-hidden rounded-2xl border border-gold/25 bg-umber shadow-[0_0_60px_-24px_rgba(201,169,110,0.35)] transition duration-300 hover:-translate-y-1 hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
    >
      <div className="relative aspect-square overflow-hidden">
        <Image
          src={philosopher.portrait}
          alt={`AI-generated portrait of ${philosopher.name} (artistic interpretation)`}
          fill
          sizes="(min-width: 1152px) 368px, (min-width: 768px) 33vw, 100vw"
          preload={index === 1}
          className="object-cover transition duration-700 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent from-45% to-umber" />
      </div>

      <div className="relative -mt-16 flex flex-1 flex-col items-center px-6 pb-8 text-center">
        <h2 className="font-display text-[2rem] font-medium uppercase leading-none tracking-[0.04em] text-gold-bright">
          {philosopher.name}
        </h2>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-stone">{philosopher.lifespan}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-stone">{philosopher.role}</p>

        <LaurelDivider className="my-6 w-full max-w-xs" />

        <blockquote className="flex flex-1 flex-col">
          <p className="font-serif text-lg italic leading-snug text-parchment/90">“{philosopher.epigraph.text}”</p>
          <footer className="mt-3 text-xs tracking-wide text-dust">{philosopher.epigraph.ref}</footer>
        </blockquote>

        <span className="mt-8 inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold/10 px-5 py-2 text-sm font-medium text-gold-bright transition group-hover:border-gold group-hover:bg-gold/20">
          {philosopher.cta}
          <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-16 pt-10 sm:px-8">
      <header className="animate-rise flex items-center justify-center">
        <p className="text-xs uppercase tracking-[0.45em] text-gold">Stoic Oracle</p>
      </header>

      <section className="mx-auto mt-12 max-w-3xl text-center sm:mt-16">
        <h1 className="animate-rise font-display text-5xl font-medium leading-[1.05] text-parchment sm:text-7xl">
          Converse with the Stoics
        </h1>
        <p
          className="animate-rise mx-auto mt-6 max-w-xl font-serif text-lg leading-relaxed text-stone sm:text-xl"
          style={{ animationDelay: "80ms" }}
        >
          Three voices from the Stoa, brought back from their own writings. They will listen, question you, and
          disagree when you are wrong — and every quotation is traced to its source and reference.
        </p>
      </section>

      <section className="mt-14 grid gap-6 md:grid-cols-3 md:items-stretch">
        {PHILOSOPHERS.map((p, i) => (
          <PhilosopherCard key={p.id} philosopher={p} index={i} />
        ))}
      </section>

      <section
        className="animate-rise mt-10 flex flex-col items-center gap-4 rounded-2xl border border-gold/15 bg-umber/60 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left"
        style={{ animationDelay: "480ms" }}
      >
        <div>
          <h2 className="font-display text-3xl text-parchment">The Council of the Stoa</h2>
          <p className="mt-1 font-serif text-base text-stone">
            Put one question to all three, and hear where they agree — and where they do not.
          </p>
        </div>
        <Link
          href="/council"
          className="shrink-0 rounded-full border border-gold/50 bg-gold/10 px-5 py-2 text-sm font-medium text-gold-bright transition hover:border-gold hover:bg-gold/20"
        >
          Convene the council →
        </Link>
      </section>

      <footer className="mt-auto space-y-1 pt-16 text-center text-xs leading-relaxed text-dust">
        <p>The philosophers are AI portrayals — roughly 70% historical record, 30% respectful imagination.</p>
        <p>Portraits are AI-generated artistic interpretations, not historical likenesses.</p>
        <p>
          Texts: public-domain translations from Project Gutenberg and Wikisource ·{" "}
          <Link href="/sources" className="text-stone underline decoration-dust/60 underline-offset-2 hover:text-gold">
            Sources
          </Link>
        </p>
      </footer>
    </main>
  );
}
