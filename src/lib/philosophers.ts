export const PHILOSOPHER_IDS = ["marcus-aurelius", "epictetus", "seneca"] as const;
export type PhilosopherId = (typeof PHILOSOPHER_IDS)[number];

export function isPhilosopherId(value: unknown): value is PhilosopherId {
  return typeof value === "string" && (PHILOSOPHER_IDS as readonly string[]).includes(value);
}

/** An authentic line from the library: shown with its reference only; the translator lives in Sources. */
export interface LibraryLine {
  text: string;
  ref: string;
  translator: string;
}

export interface Philosopher {
  id: PhilosopherId;
  name: string;
  /** Name in the philosopher's own language. */
  nativeName: string;
  /** Call to action on the home page card. */
  cta: string;
  lifespan: string;
  role: string;
  /** AI-generated artistic interpretation, not a historical likeness. */
  portrait: string;
  href: string;
  epigraph: LibraryLine;
  /** Shown on the empty chat page. */
  opening: LibraryLine;
  suggestions: string[];
}

// Every epigraph and opening line below was checked verbatim against the corpus built from `library/`.
export const PHILOSOPHERS: Philosopher[] = [
  {
    id: "marcus-aurelius",
    name: "Marcus Aurelius",
    nativeName: "Marcus Aurelius Antoninus",
    cta: "Enter the tent",
    lifespan: "121 – 180 CE",
    role: "Emperor of Rome",
    portrait: "/portraits/marcus-aurelius.jpg",
    href: "/marcus-aurelius",
    epigraph: {
      text: "Very little indeed is necessary for living a happy life.",
      ref: "Meditations VII.67",
      translator: "George Long",
    },
    opening: { text: "The universe is transformation: life is opinion.", ref: "Meditations IV.3", translator: "George Long" },
    suggestions: [
      "How do you stay calm when the people around you are difficult?",
      "I've been given responsibility I don't feel ready for.",
      "Does anything I do matter if everything is forgotten?",
      "How do I get out of bed when I don't want to?",
    ],
  },
  {
    id: "epictetus",
    name: "Epictetus",
    nativeName: "Ἐπίκτητος",
    cta: "Enter the school",
    lifespan: "c. 50 – c. 135 CE",
    role: "Teacher at Nicopolis, once a slave",
    portrait: "/portraits/epictetus.jpg",
    href: "/epictetus",
    epigraph: {
      text: "Men are disturbed not by the things which happen, but by the opinions about the things.",
      ref: "Enchiridion 5",
      translator: "George Long",
    },
    opening: { text: "Of things some are in our power, and others are not.", ref: "Enchiridion 1", translator: "George Long" },
    suggestions: [
      "I keep worrying about losing my job.",
      "Someone insulted me today and I can't let it go.",
      "How can a slave be freer than an emperor?",
      "My father is dying. How do I bear it?",
    ],
  },
  {
    id: "seneca",
    name: "Seneca",
    nativeName: "Lucius Annaeus Seneca",
    cta: "Enter the villa",
    lifespan: "c. 4 BCE – 65 CE",
    role: "Statesman and dramatist",
    portrait: "/portraits/seneca.jpg",
    href: "/seneca",
    epigraph: {
      text: "While we are postponing, life speeds by.",
      ref: "Moral Letters 1.2",
      translator: "Richard M. Gummere",
    },
    opening: { text: "Nothing, Lucilius, is ours, except time.", ref: "Moral Letters 1.3", translator: "Richard M. Gummere" },
    suggestions: [
      "I never seem to have enough time.",
      "Isn't it hypocritical to be rich and preach simplicity?",
      "How do I stop getting angry so quickly?",
      "I'm afraid of dying.",
    ],
  },
];

export function getPhilosopher(id: PhilosopherId): Philosopher {
  const found = PHILOSOPHERS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown philosopher: ${id}`);
  return found;
}
