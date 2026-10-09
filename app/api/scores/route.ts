import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { MODES, type Mode } from "@/lib/modes";

const MAX_SCORE = 500_000;
const RATE_LIMIT_MS = 5_000;

function isMode(m: unknown): m is Mode {
  return typeof m === "string" && m in MODES;
}

function num(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) return null;
  return v;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "login required" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  if (!isMode(b.mode)) return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  const score = num(b.score, 0, MAX_SCORE);
  const accuracy = num(b.accuracy, 0, 100);
  const maxCombo = num(b.maxCombo, 0, 10_000);
  const avgMs = num(b.avgMs, 0, 3_600_000);
  const questions = num(b.questions, 0, 100_000);
  if (score === null || accuracy === null || maxCombo === null || avgMs === null || questions === null) {
    return NextResponse.json({ error: "invalid fields" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Rate limit: one submission per user per 5s
  const { data: recent } = await supabase
    .from("scores")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent && Date.now() - new Date(recent.created_at).getTime() < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "too fast" }, { status: 429 });
  }

  // Profile must exist (created at tag claim); resilient fallback otherwise
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) {
    const tag = `OPERATOR-${userId.slice(-4).toUpperCase()}`;
    const { error } = await supabase.from("profiles").insert({ id: userId, tag });
    if (error) return NextResponse.json({ error: "profile missing" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("scores")
    .insert({
      user_id: userId,
      mode: b.mode,
      score,
      accuracy,
      max_combo: maxCombo,
      avg_speed_ms: avgMs,
      questions,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "insert failed" }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
