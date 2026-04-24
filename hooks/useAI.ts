"use client";

import type { CortexMode, CortexResponse } from "@/types";

export function useAI() {
  async function runCortex(input: {
    prompt: string;
    projectId?: string;
    mode: CortexMode;
  }): Promise<CortexResponse> {
    const res = await fetch("/api/ai/cortex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Cortex failed: ${res.status}`);
    return res.json();
  }

  // TODO(MVP): expose helpers for entropy, cascade, memory endpoints

  return { runCortex };
}
