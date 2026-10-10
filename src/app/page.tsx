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

/** The Council of the Stoa as the homepage's closing invitation: the three at one table. */
function CouncilBanner() {
  return (
    <Link
      href="/council"
      aria-label="Enter the Council of the Stoa: ask one question and hear three perspectives"
      style={{ animationDelay: "480ms" }}
      className="animate-rise group relative mt-10 block overflow-hidden rounded-2xl border border-gold/25 bg-umber shadow-[0_0_80px_-30px_rgba(201,169,110,0.45)] transition duration-300 hover:border-gold/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
    >
      {/* The scene: across the top on phones, the right side on wide screens, starting where the text ends. */}
      <div className="relative aspect-[2.8/1] lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[62%]">
        <Image
          src="/council/council-scene.jpg"
          alt="AI-generated scene of Marcus Aurelius, Epictetus and Seneca in conversation at one table"
          fill
          sizes="(min-width: 1152px) 740px, (min-width: 1024px) 62vw, 100vw"
          className="object-cover object-center transition duration-700 group-hover:scale-[1.03]"
        />
        {/* Darkening towards the text: downwards on phones, leftwards on wide screens. */}
        <div className="absolute inset-0 bg-gradient-to-t from-umber via-transparent to-transparent lg:bg-gradient-to-r lg:from-umber lg:via-umber/0 lg:via-[14%] lg:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-umber/25 via-transparent to-umber/40" />
      </div>

      <div className="relative px-6 pb-8 pt-2 text-center lg:min-h-[15rem] lg:w-[40%] lg:py-10 lg:pl-12 lg:pr-0 lg:text-left">
        <p className="text-xs uppercase tracking-[0.32em] text-gold">The Council of the Stoa</p>
        <h2 className="mt-3 font-display text-4xl font-medium leading-[1.05] text-parchment sm:text-5xl lg:text-4xl xl:text-5xl">
          Bring them together
        </h2>
        <p className="mt-3 font-serif text-lg text-stone">Ask one question. Hear three perspectives.</p>
        <span className="mt-7 inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-night shadow-[0_8px_30px_-10px_rgba(201,169,110,0.7)] transition group-hover:bg-gold-bright">
          Enter the Council
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

      <section className="mx-auto mt-12 max-w-5xl text-center sm:mt-16">
        <h1 className="animate-rise font-display text-5xl font-medium leading-[1.05] text-parchment sm:text-7xl">
          Seek Wisdom from the Stoics
        </h1>
        <p
          className="animate-rise mx-auto mt-6 max-w-2xl font-serif text-lg leading-relaxed text-stone sm:text-xl"
          style={{ animationDelay: "80ms" }}
        >
          Three voices from the Stoic tradition, grounded in their own writings. Ask questions, explore their ideas,
          and discover where their perspectives meet.
        </p>
      </section>

      <section className="mt-14 grid gap-6 md:grid-cols-3 md:items-stretch">
        {PHILOSOPHERS.map((p, i) => (
          <PhilosopherCard key={p.id} philosopher={p} index={i} />
        ))}
      </section>

      <CouncilBanner />

      <footer className="mt-auto pt-16 text-center text-xs leading-relaxed text-dust">
        <p>
          Texts: public-domain translations from Project Gutenberg, Standard Ebooks and Wikisource ·{" "}
          <Link href="/sources" className="text-stone underline decoration-dust/60 underline-offset-2 hover:text-gold">
            Sources
          </Link>
        </p>
      </footer>
    </main>
  );
}
