import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

// DELETE /api/comments/[id] — RLS policy "comments_delete_own" enforces
// that only the comment's author can delete it.
export async function DELETE(_request: Request, { params }: Ctx) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error, count } = await supabase
    .from("comments")
    .delete({ count: "exact" })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
