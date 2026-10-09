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
  const tag = ((body as Record<string, unknown>).tag as string)?.trim().toUpperCase() ?? "";
  if (!/^[A-Z0-9_-]{3,16}$/.test(tag)) {
    return NextResponse.json({ error: "invalid tag" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("tag")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return NextResponse.json({ tag: (existing as { tag: string }).tag });

  const { error } = await supabase.from("profiles").insert({ id: userId, tag });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "tag taken" }, { status: 409 });
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
  return NextResponse.json({ tag });
}
