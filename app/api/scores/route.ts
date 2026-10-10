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

  // Rate limit: one submission per user per 5s (fail closed on DB error)
  const { data: recent, error: recentErr } = await supabase
    .from("scores")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentErr) return NextResponse.json({ error: "try again" }, { status: 503 });
  if (recent && Date.now() - new Date(recent.created_at).getTime() < RATE_LIMIT_MS) {
    return NextResponse.json({ error: "too fast" }, { status: 429 });
  }

  // Cross-field sanity: max ~1250 pts/answer (1000 speed + 250 streak), so a
  // score must be achievable within the reported question count. Blunt but
  // effective against curl-posted fantasy scores.
  if (questions === 0 && score !== 0) {
    return NextResponse.json({ error: "invalid fields" }, { status: 400 });
  }
  if (score > 1250 * Math.max(questions, 1)) {
    return NextResponse.json({ error: "implausible score" }, { status: 400 });
  }

  // Resilient profile: auto-create a fallback tag if the picker never ran.
  // Random suffix + retry so a tag collision can never drop a legit score.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) {
    let created = false;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      const { error } = await supabase
        .from("profiles")
        .insert({ id: userId, tag: `OPERATOR-${suffix}` });
      if (!error) created = true;
      else if (error.code !== "23505") {
        return NextResponse.json({ error: "profile missing" }, { status: 500 });
      }
    }
    if (!created) return NextResponse.json({ error: "profile missing" }, { status: 500 });
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
