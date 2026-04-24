"use client";

// Live Context Panel — "Second Brain" sidebar (PRD USP-7).
// Proactively surfaces related notes, prior AI suggestions, web search, comments.
export function ContextSidebar() {
  return (
    <aside className="w-80 shrink-0 rounded-xl border border-border bg-surface/40 p-4 space-y-4">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-secondary">
          Live Context
        </p>
        <h3 className="font-display text-lg font-bold">Second Brain</h3>
      </header>
      {/* TODO(MVP): related notes · prior AI suggestions · web results · comments */}
      <p className="text-sm text-muted-foreground">
        Select a task to surface related context.
      </p>
    </aside>
  );
}
