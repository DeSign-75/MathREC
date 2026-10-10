import { createClient } from "./supabase/client";
import type { Mode } from "./modes";
export interface BoardRow {
  rank: number;
  tag: string;
  score: number;
  accuracy: number;
  maxCombo: number;
  questions: number;
  date: string;
  mine: boolean;
}

export const BOARD_PAGE_SIZE = 20;

let browser: ReturnType<typeof createClient> | null = null;

export function supabase() {
  if (!browser) browser = createClient();
  return browser;
}

export async function fetchTag(userId: string): Promise<string | null> {
  const { data } = await supabase().from("profiles").select("tag").eq("id", userId).maybeSingle();
  return (data as { tag: string } | null)?.tag ?? null;
}

/** Claim a tag via the server API (verified Clerk session, uniqueness enforced). */
export async function claimTag(tag: string): Promise<string | null> {
  const clean = tag.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,16}$/.test(clean)) return "TAG MUST BE 3-16 CHARS (A-Z 0-9 _ -)";
  try {
    const res = await fetch("/api/profile", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: clean }),
    });
    if (res.ok) return null;
    if (res.status === 401) return "LOGIN REQUIRED";
    if (res.status === 409) return "TAG TAKEN — TRY ANOTHER";
    return "COULD NOT CLAIM TAG";
  } catch {
    return "OFFLINE — TRY AGAIN";
  }
}

export interface ScorePayload {
  mode: Mode;
  score: number;
  accuracy: number;
  maxCombo: number;
  avgMs: number;
  questions: number;
}

export async function postScore(p: ScorePayload): Promise<string | null> {
  try {
    const res = await fetch("/api/scores", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (res.ok) return null;
    if (res.status === 401) return "LOGIN REQUIRED";
    if (res.status === 429) return "RATE LIMITED — TRY NEXT RUN";
    return "POST FAILED";
  } catch {
    return "OFFLINE — SAVED LOCALLY";
  }
}

export async function fetchBoard(
  mode: Mode,
  page: number,
  myId: string | null
): Promise<{ rows: BoardRow[]; total: number; error: string | null }> {
  const from = page * BOARD_PAGE_SIZE;
  const to = from + BOARD_PAGE_SIZE - 1;
  const { data, error, count } = await supabase()
    .from("scores")
    .select("score, accuracy, max_combo, questions, created_at, profiles(tag), user_id", {
      count: "exact",
    })
    .eq("mode", mode)
    .order("score", { ascending: false })
    .range(from, to);
  if (error) return { rows: [], total: 0, error: "BOARD OFFLINE" };
  const rows: BoardRow[] = ((data ?? []) as unknown as Array<Record<string, unknown>>).map(
    (r, i) => ({
      rank: from + i + 1,
      tag: ((r.profiles as unknown as { tag: string })?.tag ?? "UNKNOWN") as string,
      score: r.score as number,
      accuracy: r.accuracy as number,
      maxCombo: r.max_combo as number,
      questions: r.questions as number,
      date: new Date(r.created_at as string).toLocaleDateString(),
      mine: myId !== null && r.user_id === myId,
    })
  );
  return { rows, total: count ?? 0, error: null };
}

export async function fetchMyRank(mode: Mode, uid: string): Promise<{ rank: number; best: number } | null> {
  const { data: best } = await supabase()
    .from("scores")
    .select("score")
    .eq("mode", mode)
    .eq("user_id", uid)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!best) return null;
  const bestScore = (best as { score: number }).score;
  const { count } = await supabase()
    .from("scores")
    .select("id", { count: "exact", head: true })
    .eq("mode", mode)
    .gt("score", bestScore);
  return { rank: (count ?? 0) + 1, best: bestScore };
}
