# Stoic Oracle

An immersive web experience for conversing with Marcus Aurelius, Seneca and Epictetus — AI portrayals grounded in their own writings, with every quotation traced back to the library.

**Status:** Epictetus is live. Marcus Aurelius and Seneca are shown as "In preparation".

## Running locally

```bash
npm install
cp .env.example .env.local   # then put your key in ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000, choose Epictetus and ask him something.

Without `ANTHROPIC_API_KEY` the site still opens, but the chat replies with a "The oracle is silent" notice explaining how to configure the key. No reply is ever simulated.

The key is read only by the server route `src/app/api/chat/route.ts`; it is never sent to the browser.

## How it works

1. **Library → corpus.** `npm run corpus` reads the EPUBs in `library/` (read-only) and writes `data/corpus/epictetus.json`: 573 verbatim passages, each with a stable id and a verifiable reference.

   | Work | Translator | Reference format | Passage ids |
   | --- | --- | --- | --- |
   | Enchiridion | George Long | `Enchiridion 5` | `ench-5`, `ench-1.2` |
   | Discourses (Long's selection) | George Long | `Discourses (sel.) §14, "Title", ¶2` | `disc-14.2` |
   | The Golden Sayings | Hastings Crossley | `Golden Sayings 46` | `gs-46` |
   | Fragments (attribution uncertain) | Hastings Crossley | `Fragment 3` | `frag-3` |

   Translator footnotes, the biographical introduction and the Hymn of Cleanthes are excluded, since they are not Epictetus' words.

2. **Retrieval.** For each question, `src/lib/retrieval.ts` ranks passages with BM25 (local keyword search, with a small modern-to-19th-century vocabulary map) and picks the top 8.

3. **Generation.** `src/app/api/chat/route.ts` sends the persona (`src/lib/personas/epictetus.ts`), the conversation and the retrieved passages to Claude (`claude-sonnet-5-5`, effort `low`, no model fallback) and streams the reply back as newline-delimited JSON.

4. **Authentic vs. interpretive.** Epictetus cites passages as `[ench-5]`. In the browser (`src/lib/quotes.ts`, `src/components/chat/Reply.tsx`):
   - citations become numbered footnotes with the full verbatim passage underneath;
   - every quotation is checked word-for-word against the passages — verified quotes render in gold with ✓, anything else with a dashed underline and ≈ ("paraphrase");
   - everything else is labelled as the AI portrayal.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run corpus` | Rebuild `data/corpus/epictetus.json` from `library/` |
| `npm run lint` | ESLint |

## Library

`library/` contains public-domain EPUBs (Project Gutenberg, Wikisource). They are treated as read-only source material.
