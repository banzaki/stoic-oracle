/** Shown when the visitor has scrolled up: returns to the newest message and resumes following it. */
export function LatestButton({ onClick, streaming }: { onClick: () => void; streaming: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-rise inline-flex items-center gap-2 rounded-full border border-gold/40 bg-ash/95 px-4 py-1.5 text-xs text-parchment shadow-[0_6px_24px_-6px_rgba(0,0,0,0.8)] backdrop-blur transition hover:border-gold hover:text-gold-bright"
    >
      {streaming && <span aria-hidden="true" className="animate-flicker inline-block h-1.5 w-1.5 rounded-full bg-gold" />}
      Latest messages
      <span aria-hidden="true">↓</span>
    </button>
  );
}
