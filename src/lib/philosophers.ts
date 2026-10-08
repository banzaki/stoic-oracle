export type PhilosopherId = "marcus-aurelius" | "seneca" | "epictetus";

export interface Philosopher {
  id: PhilosopherId;
  name: string;
  /** Name in the philosopher's own language. */
  nativeName: string;
  monogram: string;
  lifespan: string;
  role: string;
  /** Short, authentic line from the library, with its reference. */
  epigraph: { text: string; ref: string };
  available: boolean;
  href?: string;
}

// Every epigraph below was checked verbatim against the EPUBs in `library/`.
export const PHILOSOPHERS: Philosopher[] = [
  {
    id: "marcus-aurelius",
    name: "Marcus Aurelius",
    nativeName: "Marcus Aurelius Antoninus",
    monogram: "M",
    lifespan: "121 – 180 CE",
    role: "Emperor of Rome",
    epigraph: {
      text: "Very little indeed is necessary for living a happy life.",
      ref: "Thoughts VII.67 · tr. George Long",
    },
    available: false,
  },
  {
    id: "epictetus",
    name: "Epictetus",
    nativeName: "Ἐπίκτητος",
    monogram: "E",
    lifespan: "c. 50 – c. 135 CE",
    role: "Teacher at Nicopolis, once a slave",
    epigraph: {
      text: "Men are disturbed not by the things which happen, but by the opinions about the things.",
      ref: "Enchiridion 5 · tr. George Long",
    },
    available: true,
    href: "/epictetus",
  },
  {
    id: "seneca",
    name: "Seneca",
    nativeName: "Lucius Annaeus Seneca",
    monogram: "S",
    lifespan: "c. 4 BCE – 65 CE",
    role: "Statesman and dramatist",
    epigraph: {
      text: "While we are postponing, life speeds by.",
      ref: "Moral Letters 1 · tr. R. M. Gummere",
    },
    available: false,
  },
];

export function getPhilosopher(id: PhilosopherId): Philosopher {
  const found = PHILOSOPHERS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown philosopher: ${id}`);
  return found;
}
