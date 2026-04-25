"use client";

import { useState } from "react";
import { Loader2, Sparkles, X, AlertCircle } from "lucide-react";
import { useAI } from "@/hooks/useAI";
import type { CortexResponse } from "@/types";

// Bottom-bar AI Execution Cortex input (PRD USP-2, §7.2).
// Renders the structured plan returned by /api/ai/cortex above the input.
export function CortexPanel({ projectId }: { projectId: string }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CortexResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { runCortex } = useAI();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await runCortex({ prompt, projectId, mode: "generate" });
      setResult(res);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cortex failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {result && <CortexResult result={result} onDismiss={() => setResult(null)} />}
      {error && (
        <div className="glass flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="glass flex items-center gap-2 rounded-xl p-2 shadow-2xl"
      >
        <Sparkles className="ml-2 size-4 text-secondary" />
        <input
          className="flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Tell me what to do next..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !prompt.trim()}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Thinking...
            </>
          ) : (
            "Run Cortex"
          )}
        </button>
      </form>
    </div>
  );
}

function CortexResult({
  result,
  onDismiss,
}: {
  result: CortexResponse;
  onDismiss: () => void;
}) {
  const taskCount = result.tasks.length;
  const depCount = result.dependencies.length;
  const criticalIds = new Set(result.criticalPath);

  return (
    <div className="glass max-h-[50vh] overflow-y-auto rounded-xl p-4 text-sm shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="size-4 text-secondary" />
          <span className="font-medium">Cortex plan</span>
          <span className="text-xs text-muted-foreground">
            {taskCount} task{taskCount === 1 ? "" : "s"} · {depCount} dependenc
            {depCount === 1 ? "y" : "ies"}
            {result.timeline.startDate && result.timeline.endDate
              ? ` · ${result.timeline.startDate} → ${result.timeline.endDate}`
              : ""}
          </span>
          {result.memoryUsed && (
            <span
              title="Estimates were adjusted based on your past task completion patterns"
              className="flex items-center gap-1 rounded-full border border-[#6C63FF]/30 bg-[#6C63FF]/10 px-2 py-0.5 text-[10px] text-[#6C63FF]/90"
            >
              🧠 Personalized from your work history
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-1 text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
          aria-label="Dismiss plan"
        >
          <X className="size-4" />
        </button>
      </div>

      {taskCount === 0 ? (
        <p className="text-muted-foreground">
          Cortex did not return any tasks. Try rephrasing the goal.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {result.tasks.map((t, i) => {
            const id = (t as { id?: string }).id ?? `t${i + 1}`;
            const onPath = criticalIds.has(id);
            return (
              <li
                key={id}
                className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${
                  onPath ? "bg-destructive/5 ring-1 ring-destructive/30" : "bg-white/[0.02]"
                }`}
              >
                <span className="mt-0.5 w-6 shrink-0 text-right text-xs text-muted-foreground">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{t.title}</span>
                    {t.priority && (
                      <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t.priority}
                      </span>
                    )}
                    {t.estimatedHours != null && (
                      <span className="text-[10px] text-muted-foreground">
                        ~{t.estimatedHours}h
                      </span>
                    )}
                    {onPath && (
                      <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                        critical path
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {result.missingSteps.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Missing steps you didn&apos;t mention
          </h4>
          <ul className="list-disc space-y-0.5 pl-5 text-xs">
            {result.missingSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>
      )}

      {result.weekOnePlan && (
        <div className="mt-4">
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Week 1 plan
          </h4>
          <pre className="whitespace-pre-wrap rounded-md bg-black/30 p-2 text-xs leading-relaxed">
            {result.weekOnePlan}
          </pre>
        </div>
      )}
    </div>
  );
}
