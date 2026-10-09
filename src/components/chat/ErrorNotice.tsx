export function ErrorNotice({ error }: { error: { code: string; message: string } }) {
  if (error.code === "missing_api_key") {
    return (
      <div className="rounded-xl border border-ember/40 bg-ember/5 p-5 text-sm leading-relaxed text-stone">
        <p className="font-display text-xl text-parchment">The oracle is silent.</p>
        <p className="mt-2">No AI provider key is configured on the server, so no reply was generated.</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>
            Create a file named <code className="text-gold-bright">.env.local</code> in the project root.
          </li>
          <li>
            Add <code className="text-gold-bright">ANTHROPIC_API_KEY=your-key</code> (from console.anthropic.com).
          </li>
          <li>Restart the development server and ask again.</li>
        </ol>
      </div>
    );
  }
  return (
    <p className="mt-3 rounded-lg border border-ember/30 bg-ember/5 px-4 py-2 text-sm text-ember">{error.message}</p>
  );
}
