import { NextResponse } from "next/server";

export const runtime = "nodejs";

// POST /api/ai/cascade — Cascade Impact Analyzer (PRD USP-4, §8.3)
export async function POST(request: Request) {
  const body = await request.json();

  // TODO(MVP): BFS traversal from changed task across dependency graph
  // TODO(MVP): compute propagated delay per descendant
  // TODO(MVP): optionally return AI rebalance suggestion

  return NextResponse.json({
    affected: [],
    totalDelayDays: 0,
    finalDateShift: null,
    rebalanceSuggestion: null,
  });
}
