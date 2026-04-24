"use client";

// AI-curated 3–5 most important tasks today (PRD §5.4).
export function TodayFocus() {
  // TODO(MVP): fetch curated tasks from Cortex ("standup" mode)
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm text-muted-foreground">
        Your AI-curated focus list will appear here.
      </p>
    </div>
  );
}
