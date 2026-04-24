import { NextResponse } from "next/server";

export const runtime = "nodejs";

// GET/POST /api/ai/memory — Execution Memory (PRD USP-6)
// Stores per-user behavioral patterns via Gemini embeddings + pgvector.

export async function GET() {
  // TODO(Phase 2): fetch user's memory patterns from ai_memory table
  return NextResponse.json({ patterns: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  // TODO(Phase 2): upsert pattern — embed via text-embedding-004, store in pgvector
  return NextResponse.json({ ok: true, received: body });
}
