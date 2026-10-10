/**
 * Keeps a conversation in this browser (localStorage) so a reload does not lose it.
 * Nothing leaves the visitor's device. Storage can be unavailable (private mode, quota),
 * so every access is guarded and failure simply means nothing is saved.
 */

import { useMemo, useSyncExternalStore } from "react";

const PREFIX = "stoic-oracle:";
const VERSION = 1;

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { v: number; data: T };
    return parsed.v === VERSION ? parsed.data : null;
  } catch {
    return null;
  }
}

const noSubscription = () => () => {};

/**
 * The saved value for `key`, read without a hydration mismatch: null while the server-rendered
 * page hydrates, then the stored value. Read once per mount; later saves don't re-render.
 */
export function useSaved<T>(key: string): T | null {
  const raw = useSyncExternalStore(noSubscription, () => readRaw(key), () => null);
  return useMemo(() => parse<T>(raw), [raw]);
}

export function save<T>(key: string, data: T) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ v: VERSION, data }));
  } catch {
    // Quota exceeded or storage disabled: the conversation just won't survive a reload.
  }
}

export function forget(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to do.
  }
}
