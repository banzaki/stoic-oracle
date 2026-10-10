/**
 * Labels for the parts of a reply that follow the conversation's language (the references
 * panel and translation notices). The rest of the interface is English-first. Languages
 * without an entry fall back to English labels; passages are still translated into them.
 */

export interface ReplyLabels {
  references: (n: number) => string;
  consulted: (n: number) => string;
  citedHeading: string;
  alsoConsulted: (n: number) => string;
  translationNote: string;
  aiTranslation: (translator: string) => string;
  original: (translator: string) => string;
  showOriginal: string;
  showTranslation: string;
  translating: string;
  translationFailed: string;
  readFull: string;
  showLess: string;
  aboutSource: string;
  work: string;
  translation: string;
  edition: string;
  /** Short mark after a translated quotation, e.g. "trad.". */
  translatedMark: string;
  verifiedTranslated: (ref: string) => string;
  verified: (ref: string) => string;
  unverified: string;
  unknownReference: string;
}

type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

function plural(language: string, forms: Plural) {
  const rules = new Intl.PluralRules(language);
  return (n: number) => (forms[rules.select(n)] ?? forms.other).replace("{n}", String(n));
}

const en: ReplyLabels = {
  references: plural("en", { one: "{n} reference", other: "{n} references" }),
  consulted: plural("en", { one: "{n} passage consulted", other: "{n} passages consulted" }),
  citedHeading: "Cited in this reply",
  alsoConsulted: (n) => `Also consulted (${n})`,
  // Shown only when the conversation is in a language without its own labels.
  translationNote: "Quotations and passages are AI translations of the English editions; the original is with each source.",
  aiTranslation: (t) => `AI translation from ${t}'s English`,
  original: (t) => `Original English · tr. ${t}`,
  showOriginal: "Show the original English",
  showTranslation: "Show the translation",
  translating: "Translating…",
  translationFailed: "Translation unavailable; showing the original.",
  readFull: "Read the full passage",
  showLess: "Show less",
  aboutSource: "About this source",
  work: "Work",
  translation: "Translation",
  edition: "Edition",
  translatedMark: "tr.",
  verifiedTranslated: (ref) => `AI translation; the English original was verified word for word in ${ref}`,
  verified: (ref) => `Verbatim from ${ref}`,
  unverified: "Attributed to the library but not found there word for word — read it as paraphrase.",
  unknownReference: "This reference does not match any passage in the library.",
};

const LABELS: Record<string, ReplyLabels> = {
  en,
  pt: {
    references: plural("pt", { one: "{n} referência", other: "{n} referências" }),
    consulted: plural("pt", { one: "{n} trecho consultado", other: "{n} trechos consultados" }),
    citedHeading: "Citados nesta resposta",
    alsoConsulted: (n) => `Também consultados (${n})`,
    translationNote: "Citações e trechos traduzidos por IA a partir das edições inglesas; o original fica em cada fonte.",
    aiTranslation: (t) => `Tradução por IA do inglês de ${t}`,
    original: (t) => `Original em inglês · trad. ${t}`,
    showOriginal: "Ver o original em inglês",
    showTranslation: "Ver a tradução",
    translating: "Traduzindo…",
    translationFailed: "Tradução indisponível; mostrando o original.",
    readFull: "Ler o trecho completo",
    showLess: "Mostrar menos",
    aboutSource: "Sobre a fonte",
    work: "Obra",
    translation: "Tradução",
    edition: "Edição",
    translatedMark: "trad.",
    verifiedTranslated: (ref) => `Tradução por IA; o original em inglês foi conferido palavra por palavra em ${ref}`,
    verified: (ref) => `Texto literal de ${ref}`,
    unverified: "Atribuída à biblioteca, mas não encontrada palavra por palavra — leia como paráfrase.",
    unknownReference: "Esta referência não corresponde a nenhum trecho da biblioteca.",
  },
  es: {
    references: plural("es", { one: "{n} referencia", other: "{n} referencias" }),
    consulted: plural("es", { one: "{n} pasaje consultado", other: "{n} pasajes consultados" }),
    citedHeading: "Citados en esta respuesta",
    alsoConsulted: (n) => `También consultados (${n})`,
    translationNote: "Citas y pasajes traducidos por IA de las ediciones inglesas; el original está en cada fuente.",
    aiTranslation: (t) => `Traducción por IA del inglés de ${t}`,
    original: (t) => `Original en inglés · trad. ${t}`,
    showOriginal: "Ver el original en inglés",
    showTranslation: "Ver la traducción",
    translating: "Traduciendo…",
    translationFailed: "Traducción no disponible; se muestra el original.",
    readFull: "Leer el pasaje completo",
    showLess: "Mostrar menos",
    aboutSource: "Sobre la fuente",
    work: "Obra",
    translation: "Traducción",
    edition: "Edición",
    translatedMark: "trad.",
    verifiedTranslated: (ref) => `Traducción por IA; el original inglés se verificó palabra por palabra en ${ref}`,
    verified: (ref) => `Texto literal de ${ref}`,
    unverified: "Atribuida a la biblioteca, pero no encontrada palabra por palabra: léala como paráfrasis.",
    unknownReference: "Esta referencia no corresponde a ningún pasaje de la biblioteca.",
  },
  fr: {
    references: plural("fr", { one: "{n} référence", other: "{n} références" }),
    consulted: plural("fr", { one: "{n} passage consulté", other: "{n} passages consultés" }),
    citedHeading: "Cités dans cette réponse",
    alsoConsulted: (n) => `Également consultés (${n})`,
    translationNote: "Citations et passages traduits par IA depuis les éditions anglaises ; l’original figure dans chaque source.",
    aiTranslation: (t) => `Traduction par IA de l’anglais de ${t}`,
    original: (t) => `Original anglais · trad. ${t}`,
    showOriginal: "Voir l’original anglais",
    showTranslation: "Voir la traduction",
    translating: "Traduction…",
    translationFailed: "Traduction indisponible ; affichage de l’original.",
    readFull: "Lire le passage complet",
    showLess: "Réduire",
    aboutSource: "À propos de la source",
    work: "Œuvre",
    translation: "Traduction",
    edition: "Édition",
    translatedMark: "trad.",
    verifiedTranslated: (ref) => `Traduction par IA ; l’original anglais a été vérifié mot à mot dans ${ref}`,
    verified: (ref) => `Texte littéral de ${ref}`,
    unverified: "Attribuée à la bibliothèque mais introuvable mot à mot — à lire comme une paraphrase.",
    unknownReference: "Cette référence ne correspond à aucun passage de la bibliothèque.",
  },
  it: {
    references: plural("it", { one: "{n} riferimento", other: "{n} riferimenti" }),
    consulted: plural("it", { one: "{n} passo consultato", other: "{n} passi consultati" }),
    citedHeading: "Citati in questa risposta",
    alsoConsulted: (n) => `Consultati anche (${n})`,
    translationNote: "Citazioni e passi tradotti dall’IA dalle edizioni inglesi; l’originale è in ogni fonte.",
    aiTranslation: (t) => `Traduzione IA dall’inglese di ${t}`,
    original: (t) => `Originale inglese · trad. ${t}`,
    showOriginal: "Vedi l’originale inglese",
    showTranslation: "Vedi la traduzione",
    translating: "Traduzione in corso…",
    translationFailed: "Traduzione non disponibile; si mostra l’originale.",
    readFull: "Leggi il passo completo",
    showLess: "Mostra meno",
    aboutSource: "Informazioni sulla fonte",
    work: "Opera",
    translation: "Traduzione",
    edition: "Edizione",
    translatedMark: "trad.",
    verifiedTranslated: (ref) => `Traduzione IA; l’originale inglese è stato verificato parola per parola in ${ref}`,
    verified: (ref) => `Testo letterale di ${ref}`,
    unverified: "Attribuita alla biblioteca ma non trovata parola per parola: leggila come parafrasi.",
    unknownReference: "Questo riferimento non corrisponde ad alcun passo della biblioteca.",
  },
  de: {
    references: plural("de", { one: "{n} Quelle", other: "{n} Quellen" }),
    consulted: plural("de", { one: "{n} Stelle herangezogen", other: "{n} Stellen herangezogen" }),
    citedHeading: "In dieser Antwort zitiert",
    alsoConsulted: (n) => `Ebenfalls herangezogen (${n})`,
    translationNote: "Zitate und Stellen sind KI-Übersetzungen der englischen Ausgaben; das Original steht bei jeder Quelle.",
    aiTranslation: (t) => `KI-Übersetzung aus dem Englischen von ${t}`,
    original: (t) => `Englisches Original · übers. von ${t}`,
    showOriginal: "Englisches Original zeigen",
    showTranslation: "Übersetzung zeigen",
    translating: "Wird übersetzt…",
    translationFailed: "Übersetzung nicht verfügbar; das Original wird gezeigt.",
    readFull: "Ganze Stelle lesen",
    showLess: "Weniger zeigen",
    aboutSource: "Über die Quelle",
    work: "Werk",
    translation: "Übersetzung",
    edition: "Ausgabe",
    translatedMark: "Übers.",
    verifiedTranslated: (ref) => `KI-Übersetzung; das englische Original wurde Wort für Wort in ${ref} geprüft`,
    verified: (ref) => `Wörtlich aus ${ref}`,
    unverified: "Der Bibliothek zugeschrieben, aber dort nicht wörtlich gefunden – als Paraphrase lesen.",
    unknownReference: "Diese Angabe entspricht keiner Stelle der Bibliothek.",
  },
  hr: {
    references: plural("hr", { one: "{n} izvor", few: "{n} izvora", other: "{n} izvora" }),
    consulted: plural("hr", { one: "{n} konzultirani odlomak", few: "{n} konzultirana odlomka", other: "{n} konzultiranih odlomaka" }),
    citedHeading: "Citirano u ovom odgovoru",
    alsoConsulted: (n) => `Također konzultirano (${n})`,
    translationNote: "Citati i odlomci prevedeni su umjetnom inteligencijom s engleskih izdanja; izvornik je uz svaki izvor.",
    aiTranslation: (t) => `AI prijevod s engleskog prijevoda (${t})`,
    original: (t) => `Engleski izvornik · prev. ${t}`,
    showOriginal: "Prikaži engleski izvornik",
    showTranslation: "Prikaži prijevod",
    translating: "Prevodi se…",
    translationFailed: "Prijevod nije dostupan; prikazan je izvornik.",
    readFull: "Pročitaj cijeli odlomak",
    showLess: "Prikaži manje",
    aboutSource: "O izvoru",
    work: "Djelo",
    translation: "Prijevod",
    edition: "Izdanje",
    translatedMark: "prijev.",
    verifiedTranslated: (ref) => `AI prijevod; engleski izvornik provjeren je riječ po riječ u ${ref}`,
    verified: (ref) => `Doslovno iz ${ref}`,
    unverified: "Pripisano knjižnici, ali nije pronađeno doslovno — čitajte kao parafrazu.",
    unknownReference: "Ova referenca ne odgovara nijednom odlomku knjižnice.",
  },
};

/** Labels for a conversation language (ISO 639-1); English when the language is unknown or not listed. */
export function replyLabels(language: string): ReplyLabels {
  return LABELS[language] ?? en;
}

/** Whether passages should be offered in translation for this language. */
export function translatesPassages(language: string): boolean {
  return /^[a-z]{2,3}$/.test(language) && language !== "en" && language !== "und";
}
