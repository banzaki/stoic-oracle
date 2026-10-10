"use client";

import { useEffect, useId, useRef, useState } from "react";

/** The "⋯" menu in a conversation header: start over, or download the conversation. */
export function ConversationMenu({
  disabled,
  onNew,
  onExport,
}: {
  /** True while there is nothing to act on, or a reply is still being written. */
  disabled: boolean;
  onNew: () => void;
  onExport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const item =
    "block w-full rounded-lg px-3 py-2 text-left text-sm text-parchment/90 transition hover:bg-ash hover:text-gold-bright";
  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Conversation options"
        className="rounded-full border border-gold/30 px-2.5 py-1 text-xs text-stone transition hover:border-gold/60 hover:text-gold-bright disabled:cursor-not-allowed disabled:opacity-30"
      >
        ⋯
      </button>
      {open && (
        <div
          id={menuId}
          className="animate-rise absolute right-0 top-full z-30 mt-2 w-52 rounded-xl border border-gold/20 bg-umber p-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.9)]"
        >
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              onExport();
            }}
          >
            Download conversation
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              if (window.confirm("Start a new conversation? This one will be cleared from this browser.")) onNew();
            }}
          >
            New conversation
          </button>
        </div>
      )}
    </div>
  );
}
