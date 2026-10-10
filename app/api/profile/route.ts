import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

/** Claim the operator tag for the logged-in user (one tag per user). */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "login required" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const raw = (body as Record<string, unknown>).tag;
  const tag = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!/^[A-Z0-9_-]{3,16}$/.test(tag)) {
    return NextResponse.json({ error: "invalid tag" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("tag")
    .eq("id", userId)
    .maybeSingle();
  if (existing) {
    // Rename (or confirm): no-op when unchanged, 409 when taken.
    if ((existing as { tag: string }).tag === tag) {
      return NextResponse.json({ tag });
    }
    const { error } = await supabase.from("profiles").update({ tag }).eq("id", userId);
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "tag taken" }, { status: 409 });
      return NextResponse.json({ error: "update failed" }, { status: 500 });
    }
    return NextResponse.json({ tag });
  }

  const { error } = await supabase.from("profiles").insert({ id: userId, tag });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "tag taken" }, { status: 409 });
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
  return NextResponse.json({ tag });
}
