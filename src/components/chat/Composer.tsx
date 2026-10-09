"use client";

import { useEffect, useRef, useState } from "react";

interface ComposerProps {
  label: string;
  placeholder: string;
  busy: boolean;
  onSend: (text: string) => unknown;
  onStop: () => void;
}

/**
 * Message box pinned to the bottom of the page. It sits in the normal page flow
 * (sticky, not fixed) with an opaque background, so it never covers the end of
 * the conversation, however tall the box grows.
 */
export function Composer({ label, placeholder, busy, onSend, onStop }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!busy) inputRef.current?.focus({ preventScroll: true });
  }, [busy]);

  function send() {
    if (busy || !draft.trim()) return;
    onSend(draft);
    setDraft("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="sticky bottom-0 z-10 border-t border-gold/10 bg-night pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 before:pointer-events-none before:absolute before:inset-x-0 before:-top-8 before:h-8 before:bg-gradient-to-t before:from-night before:to-transparent"
    >
      <div className="mx-auto flex max-w-3xl items-end gap-3 px-4 sm:px-5">
        <label htmlFor="message" className="sr-only">
          {label}
        </label>
        <textarea
          id="message"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder={placeholder}
          className="field-sizing-content max-h-40 min-h-[3.25rem] flex-1 resize-none rounded-2xl border border-gold/25 bg-umber px-5 py-3.5 font-serif text-lg text-parchment placeholder:text-dust focus:border-gold/60 focus:outline-none"
        />
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            className="h-[3.25rem] rounded-2xl border border-gold/30 px-5 text-sm text-stone transition hover:border-gold hover:text-parchment"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!draft.trim()}
            className="h-[3.25rem] rounded-2xl bg-gold px-5 text-sm font-semibold text-night transition hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        )}
      </div>
    </form>
  );
}
