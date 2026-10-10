"use client";

import { useEffect, useState } from "react";
import { translatesPassages } from "@/lib/i18n";

// One request per passage and language for the whole visit, shared by every card that shows it.
const requests = new Map<string, Promise<string>>();

function requestTranslation(id: string, language: string, excerpt?: string): Promise<string> {
  const key = `${language}:${id}${excerpt ? `:${excerpt}` : ""}`;
  let pending = requests.get(key);
  if (!pending) {
    pending = fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, language, excerpt }),
    }).then(async (res) => {
      const payload = await res.json().catch(() => null);
      if (!res.ok || typeof payload?.translation !== "string") throw new Error(payload?.error?.code ?? "failed");
      return payload.translation as string;
    });
    // A failed request may be retried the next time the passage is shown.
    pending.catch(() => requests.delete(key));
    requests.set(key, pending);
  }
  return pending;
}

export type TranslationState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "failed" };

/**
 * AI translation of a library passage (or of an `excerpt` of it) into the conversation's
 * language, fetched when first needed.
 */
export function usePassageTranslation(id: string, language: string, excerpt?: string): TranslationState {
  const wanted = translatesPassages(language);
  const [result, setResult] = useState<{ key: string; state: TranslationState } | null>(null);
  const key = `${language}:${id}:${excerpt ?? ""}`;

  useEffect(() => {
    if (!wanted) return;
    let active = true;
    requestTranslation(id, language, excerpt).then(
      (text) => active && setResult({ key, state: { status: "done", text } }),
      () => active && setResult({ key, state: { status: "failed" } }),
    );
    return () => {
      active = false;
    };
  }, [wanted, id, language, excerpt, key]);

  if (!wanted) return { status: "none" };
  return result?.key === key ? result.state : { status: "loading" };
}
