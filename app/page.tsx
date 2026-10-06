"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BASE_POINTS,
  DIFFICULTIES,
  LIVES,
  MAX_STREAK_BONUS,
  STREAK_BONUS,
  type Difficulty,
} from "../lib/difficulty";
import { generateQuestion, type Question } from "../lib/questions";
import {
  clickSfx,
  correctSfx,
  gameOverSfx,
  sweepSfx,
  tickSfx,
  timeoutSfx,
  unlockAudio,
  welcomeSfx,
  wrongSfx,
} from "../lib/sound";
import PixelTransition from "../components/PixelTransition";

type Screen = "title" | "modes" | "difficulty" | "playing" | "gameover";
type Reveal = { picked: number | null; correct: boolean; timeout?: boolean } | null;

const KEY_HINTS = ["A / 1", "B / 2", "C / 3", "D / 4"];

function bestKey(d: Difficulty) {
  return `mathrec-best-${d}`;
}

function readBest(d: Difficulty): number {
  try {
    return Number(localStorage.getItem(bestKey(d)) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function rankTier(score: number): string {
  if (score >= 2000) return "CIRCUIT MASTER";
  if (score >= 800) return "VECTOR ADEPT";
  if (score >= 300) return "CIRCUIT RUNNER";
  if (score > 0) return "OPERATIVE";
  return "UNRANKED";
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("title");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [question, setQuestion] = useState<Question | null>(null);
  const [qNum, setQNum] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [reveal, setReveal] = useState<Reveal>(null);
  const [best, setBest] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [transitionTo, setTransitionTo] = useState<Screen | null>(null);
  // Run stats
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [runBest, setRunBest] = useState(0);
  // Session stats (title footer)
  const [sessionBest, setSessionBest] = useState(0);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [sessionFastest, setSessionFastest] = useState(0);
  const [operatorId] = useState(() => `GUEST-${Math.floor(1000 + Math.random() * 9000)}`);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadline = useRef<number>(0);
  const timeoutRef = useRef<() => void>(() => {});
  const lastTick = useRef(-1);
  const welcomed = useRef(false);
  const fastestRef = useRef(0);
  const keyHandler = useRef((_e: KeyboardEvent) => {});

  const loadBest = useCallback((d: Difficulty) => {
    setBest(readBest(d));
  }, []);

  useEffect(() => {
    loadBest(difficulty);
  }, [difficulty, loadBest]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Unlock audio on load attempt + first interaction anywhere, then welcome jingle
  useEffect(() => {
    unlockAudio();
    const greet = () => {
      if (welcomed.current) return;
      welcomed.current = true;
      unlockAudio();
      welcomeSfx();
    };
    window.addEventListener("pointerdown", greet, { once: true });
    return () => window.removeEventListener("pointerdown", greet);
  }, []);

  // Session stats snapshot when a run ends
  useEffect(() => {
    if (screen !== "gameover") return;
    setSessionBest((b) => Math.max(b, score));
    setSessionStreak((s) => Math.max(s, maxStreak));
    if (fastestRef.current > 0) {
      const f = fastestRef.current;
      setSessionFastest((prev) => (prev === 0 ? f : Math.min(prev, f)));
    }
  }, [screen, score, maxStreak]);

  const goWithTransition = (to: Screen) => {
    if (transitionTo) return;
    sweepSfx();
    if (timer.current) clearTimeout(timer.current);
    setTransitionTo(to);
    setTimeout(() => {
      setScreen(to);
      setTransitionTo(null);
    }, 1050);
  };

  const startGame = (d: Difficulty) => {
    unlockAudio();
    clickSfx();
    setDifficulty(d);
    setRunBest(readBest(d));
    loadBest(d);
    setScore(0);
    setStreak(0);
    setLives(LIVES);
    setQNum(1);
    setReveal(null);
    setAnswered(0);
    setCorrectCount(0);
    setMaxStreak(0);
    setTotalMs(0);
    fastestRef.current = 0;
    setQuestion(generateQuestion(d));
    setScreen("playing");
  };

  const nextQuestion = useCallback(
    (qCount: number) => {
      setQNum(qCount);
      setReveal(null);
      setQuestion(generateQuestion(difficulty));
    },
    [difficulty]
  );

  const quitToModes = () => {
    clickSfx();
    if (timer.current) clearTimeout(timer.current);
    setReveal(null);
    setScreen("modes");
  };

  const elapsedMs = () => {
    const total = DIFFICULTIES[difficulty].timeLimit * 1000;
    return Math.min(total, Math.max(0, total - (deadline.current - Date.now())));
  };

  const miss = (picked: number | null, timedOut: boolean, ms: number) => {
    if (timedOut) timeoutSfx();
    else wrongSfx();
    const remaining = lives - 1;
    setLives(remaining);
    setStreak(0);
    setAnswered((a) => a + 1);
    setTotalMs((t) => t + ms);
    setReveal({ picked, correct: false, timeout: timedOut });
    if (remaining <= 0) {
      timer.current = setTimeout(() => {
        gameOverSfx();
        setScreen("gameover");
      }, 1100);
    } else {
      timer.current = setTimeout(() => nextQuestion(qNum + 1), 1100);
    }
  };

  // Always point the countdown at the latest game state (avoids stale closures)
  useEffect(() => {
    timeoutRef.current = () => {
      if (screen !== "playing" || !question || reveal) return;
      miss(null, true, DIFFICULTIES[difficulty].timeLimit * 1000);
    };
  });

  // Per-question countdown. Stops once an answer is revealed.
  useEffect(() => {
    if (screen !== "playing" || !question || reveal) return;
    const total = DIFFICULTIES[difficulty].timeLimit * 1000;
    deadline.current = Date.now() + total;
    lastTick.current = -1;
    setTimeLeft(total);
    const id = setInterval(() => {
      const remaining = deadline.current - Date.now();
      if (remaining <= 0) {
        clearInterval(id);
        setTimeLeft(0);
        timeoutRef.current();
      } else {
        setTimeLeft(remaining);
        const secs = Math.ceil(remaining / 1000);
        if (secs <= 3 && secs >= 1 && secs !== lastTick.current) {
          lastTick.current = secs;
          tickSfx();
        }
      }
    }, 100);
    return () => clearInterval(id);
  }, [screen, question, qNum, difficulty, reveal]);

  const answer = (choice: number) => {
    if (screen !== "playing" || !question || reveal) return;
    const ms = elapsedMs();
    if (choice === question.answer) {
      correctSfx();
      const bonus = Math.min(streak * STREAK_BONUS, MAX_STREAK_BONUS);
      const gained = Math.round((BASE_POINTS + bonus) * DIFFICULTIES[difficulty].multiplier);
      const newScore = score + gained;
      setScore(newScore);
      const newStreak = streak + 1;
      setStreak(newStreak);
      setMaxStreak((m) => Math.max(m, newStreak));
      setAnswered((a) => a + 1);
      setCorrectCount((c) => c + 1);
      setTotalMs((t) => t + ms);
      if (fastestRef.current === 0 || ms < fastestRef.current) fastestRef.current = ms;
      setReveal({ picked: choice, correct: true });
      if (newScore > best) {
        setBest(newScore);
        try {
          localStorage.setItem(bestKey(difficulty), String(newScore));
        } catch {
          /* ignore */
        }
      }
      timer.current = setTimeout(() => nextQuestion(qNum + 1), 750);
    } else {
      miss(choice, false, ms);
    }
  };

  // Keyboard controls — latest state via ref, single listener
  keyHandler.current = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === " ") e.preventDefault();
    if (screen === "title") {
      if (k === " " || k === "enter") goWithTransition("modes");
    } else if (screen === "modes") {
      if (k === "1" || k === " ") {
        clickSfx();
        setScreen("difficulty");
      } else if (k === "escape") setScreen("title");
    } else if (screen === "difficulty") {
      if (k === "1") startGame("easy");
      else if (k === "2") startGame("medium");
      else if (k === "3") startGame("hard");
      else if (k === "escape") setScreen("modes");
    } else if (screen === "playing") {
      if (k === "escape") quitToModes();
      else if (question && !reveal) {
        const idx = ["1", "2", "3", "4", "a", "b", "c", "d"].indexOf(k) % 4;
        if (["1", "2", "3", "4", "a", "b", "c", "d"].includes(k)) answer(question.choices[idx]);
      }
    } else if (screen === "gameover") {
      if (k === " " || k === "enter") startGame(difficulty);
      else if (k === "escape") setScreen("modes");
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const total = DIFFICULTIES[difficulty].timeLimit * 1000;
  const pct = Math.max(0, Math.min(100, (timeLeft / total) * 100));
  const urgent = pct <= 25;
  const secsLeft = Math.ceil(timeLeft / 1000);
  const accuracy = answered > 0 ? Math.round((correctCount / answered) * 100) : 0;
  const avgSpeed = answered > 0 ? `${(totalMs / answered / 1000).toFixed(2)}s` : "—";
  const isNewBest = score > runBest && score > 0;
  const lastGain = Math.round(
    (BASE_POINTS + Math.min(Math.max(streak - 1, 0) * STREAK_BONUS, MAX_STREAK_BONUS)) *
      DIFFICULTIES[difficulty].multiplier
  );

  return (
    <main className="grid-bg relative min-h-screen bg-void font-tech text-white">
      <div className="scanlines pointer-events-none fixed inset-0 z-30 opacity-60" />
      <div className="vignette pointer-events-none fixed inset-0 z-30" />
      {/* HUD corner reticles */}
      <div className="pointer-events-none fixed left-4 top-4 z-30 h-8 w-8 border-l-2 border-t-2 border-cyber-cyan/60" />
      <div className="pointer-events-none fixed right-4 top-4 z-30 h-8 w-8 border-r-2 border-t-2 border-cyber-cyan/60" />
      <div className="pointer-events-none fixed bottom-4 left-4 z-30 h-8 w-8 border-b-2 border-l-2 border-cyber-cyan/60" />
      <div className="pointer-events-none fixed bottom-4 right-4 z-30 h-8 w-8 border-b-2 border-r-2 border-cyber-cyan/60" />

      <div className="relative z-20 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-4 md:px-6 md:py-5">
        {/* ===== TITLE ===== */}
        {screen === "title" && (
          <>
            <header className="flex items-center justify-between border-b border-cyber-border/70 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded border border-cyber-border bg-cyber-surface/90 px-3 py-1 font-mono text-xs tracking-wider">
                  <span className="inline-block h-2 w-2 animate-ping rounded-full bg-cyber-cyan" />
                  <span className="font-semibold text-cyber-cyan">MATHREC</span>
                  <span className="text-gray-500">|</span>
                  <span className="text-gray-400">v2.4 // DARK CIRCUIT EDITION</span>
                </div>
                <div className="hidden items-center gap-3 pl-2 font-mono text-xs text-gray-400 md:flex">
                  <span>
                    SERVER: <span className="text-emerald-400">ONLINE</span>
                  </span>
                  <span className="text-gray-600">/</span>
                  <span>
                    LATENCY: <span className="text-emerald-400">14ms</span>
                  </span>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-md border border-cyber-border/90 bg-cyber-surface/70 px-3.5 py-1 font-mono text-xs sm:flex">
                <span className="mr-1 text-gray-400">ID:</span>
                <span className="font-semibold tracking-wider text-white">OPERATOR // {operatorId}</span>
              </div>
            </header>

            <section className="animate-pop relative flex flex-1 flex-col items-center justify-center py-10 text-center">
              <div className="animate-pulse-aura pointer-events-none absolute left-1/2 top-1/2 h-[350px] w-[650px] max-w-full rounded-full bg-cyber-cyan/15 blur-[110px]" />
              <div className="relative rounded-full border border-cyber-cyan/40 bg-cyber-cyan/10 px-5 py-1.5 font-mono text-xs tracking-[0.3em] text-cyber-cyan">
                NEURAL SPEED ARITHMETIC ENGINE
              </div>
              <h1 className="relative mt-6 font-display text-7xl font-black tracking-wide md:text-8xl">
                <span className="text-glow-white text-white">Math</span>
                <span className="text-glow-cyan text-cyber-cyan">REC</span>
              </h1>
              <p className="relative mt-4 font-mono text-sm tracking-[0.4em] text-gray-400">
                [ DARK CIRCUIT EDITION ]
              </p>
              <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3 font-mono text-sm tracking-[0.2em]">
                <span className="rounded border border-cyber-border bg-cyber-surface/80 px-3 py-1 text-cyber-cyan">
                  4 CHOICES
                </span>
                <span className="rounded border border-cyber-border bg-cyber-surface/80 px-3 py-1 text-crimson">
                  3 LIVES
                </span>
                <span className="rounded border border-cyber-border bg-cyber-surface/80 px-3 py-1 text-amber">
                  BEAT THE TIMER
                </span>
              </div>
              <button
                onClick={() => goWithTransition("modes")}
                className="relative mt-10 flex items-center gap-3 rounded-xl border border-cyber-cyan bg-white px-12 py-4 font-display text-xl font-bold tracking-[0.25em] text-black transition hover:shadow-[0_0_35px_rgba(0,240,255,0.55)] active:scale-95"
                style={{ boxShadow: "0 0 24px rgba(0,240,255,0.45)" }}
              >
                ▶ START GAME
              </button>
              <p className="relative mt-4 font-mono text-xs tracking-[0.25em] text-gray-500">
                PRESS <span className="rounded border border-cyber-border bg-cyber-surface px-1.5 py-0.5 text-gray-300">SPACE</span> OR{" "}
                <span className="rounded border border-cyber-border bg-cyber-surface px-1.5 py-0.5 text-gray-300">ENTER</span> TO INITIATE
              </p>
            </section>

            <footer className="flex flex-col items-center justify-between gap-3 border-t border-cyber-border/70 pt-3 font-mono text-xs md:flex-row">
              <div className="flex items-center gap-5">
                <span className="text-gray-500">
                  SESSION BEST <span className="text-cyber-cyan">{sessionBest}</span>
                </span>
                <span className="text-gray-500">
                  MAX STREAK <span className="text-mint">×{sessionStreak}</span>
                </span>
                <span className="text-gray-500">
                  RANK TIER <span className="text-fuchsia-400">{rankTier(sessionBest)}</span>
                </span>
              </div>
              <button
                onClick={() => {
                  clickSfx();
                  setScreen("modes");
                }}
                className="rounded border border-cyber-border bg-cyber-surface/80 px-4 py-1.5 tracking-[0.2em] text-gray-300 transition hover:border-cyber-cyan hover:text-cyber-cyan"
              >
                MODES
              </button>
            </footer>
          </>
        )}

        {/* ===== MODES ===== */}
        {screen === "modes" && (
          <>
            <header className="flex items-center justify-between border-b border-cyber-border/70 pb-3">
              <div className="flex items-center gap-4">
                <div className="rounded-lg border border-cyber-cyan/50 bg-cyber-surface/90 px-3.5 py-1.5 font-display text-xl font-black tracking-widest text-white shadow-glowcyan">
                  Math<span className="text-cyber-cyan">REC</span>
                </div>
                <div className="font-mono text-xs tracking-[0.2em]">
                  <p className="text-cyber-cyan/70">SYSTEM // CORE PROTOCOL</p>
                  <p className="mt-0.5 font-semibold text-white">SELECT PROTOCOL // GAME MODE</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded border border-cyber-border bg-cyber-surface/70 px-3 py-1.5 font-mono text-xs tracking-[0.2em] text-cyber-cyan sm:flex">
                  <span className="inline-block h-2 w-2 rounded-full bg-cyber-cyan" /> ONLINE // NODE 01
                </div>
                <button
                  onClick={() => {
                    clickSfx();
                    setScreen("title");
                  }}
                  className="rounded border border-cyber-border bg-cyber-surface/80 px-3.5 py-1.5 font-mono text-xs tracking-[0.2em] text-gray-300 transition hover:border-cyber-cyan hover:text-cyber-cyan"
                >
                  ← [ESC] BACK
                </button>
              </div>
            </header>

            <section className="animate-pop mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-8">
              <p className="text-center font-mono text-sm tracking-[0.45em] text-cyber-cyan/80">
                TACTICAL ARITHMETIC SIMULATION
              </p>
              <h2 className="text-glow-white mt-2 text-center font-display text-4xl font-black tracking-wider text-white md:text-5xl">
                DEPLOY EXECUTION VECTOR
              </h2>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <button
                  onClick={() => {
                    clickSfx();
                    setScreen("difficulty");
                  }}
                  className="group rounded-xl border-2 border-cyber-cyan bg-cyber-surface/90 p-6 text-left shadow-glowcyan transition hover:shadow-[0_0_35px_rgba(0,240,255,0.4)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 rounded border border-cyber-cyan/60 bg-cyber-cyan/10 px-2.5 py-1 font-mono text-xs tracking-[0.2em] text-cyber-cyan">
                      PRIMARY PROTOCOL [1] <span className="inline-block h-2 w-2 rounded-full bg-mint" />
                    </span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyber-cyan text-xl text-black shadow-glowcyan transition group-hover:scale-110">
                      ▶
                    </span>
                  </div>
                  <p className="mt-5 font-display text-3xl font-bold tracking-wider text-white">CLASSIC</p>
                  <p className="mt-1 font-tech text-base text-gray-300">Standard Rapid Arithmetic Evaluation</p>
                  <p className="mt-2 font-mono text-xs tracking-wider">
                    <span className="text-cyber-cyan">4 choices</span>
                    <span className="text-gray-600"> · </span>
                    <span className="text-gray-300">3 lives</span>
                    <span className="text-gray-600"> · </span>
                    <span className="text-crimson">dynamic red timer bar</span>
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-cyber-border/70 pt-3 font-mono text-xs tracking-[0.15em]">
                    <span className="text-gray-500">
                      SPEED: <span className="text-white">NORMAL</span>
                      <span className="ml-3">DIFFICULTY: <span className="text-cyber-cyan">ADAPTIVE</span></span>
                    </span>
                    <span className="font-bold text-cyber-cyan">ENGAGE →</span>
                  </div>
                </button>

                {[
                  { tag: "PROTOCOL [2]", name: "TIME ATTACK", desc: "60-second rapid frenzy; solve as many equations as possible.", foot: "LIMIT: 60 SECONDS" },
                  { tag: "PROTOCOL [3]", name: "SURVIVAL", desc: "Sudden death challenge, 1 life only, accelerating tempo.", foot: "HP: 1 LIFE ONLY" },
                  { tag: "PROTOCOL [4] · SEED EVENT", name: "DAILY CHALLENGE", desc: "Global synchronized seed puzzle, daily reward multipliers.", foot: "LEADERBOARD: GLOBAL" },
                ].map((m) => (
                  <div key={m.name} className="rounded-xl border border-cyber-border/70 bg-cyber-surface/50 p-6 opacity-60" aria-disabled="true">
                    <div className="flex items-center justify-between">
                      <span className="rounded border border-amber/50 bg-amber/10 px-2.5 py-1 font-mono text-xs tracking-[0.2em] text-amber">
                        {m.tag}
                      </span>
                      <span className="rounded border border-amber/40 px-2.5 py-1 font-mono text-xs tracking-[0.2em] text-amber/80">
                        🔒 COMING SOON
                      </span>
                    </div>
                    <p className="mt-5 font-display text-3xl font-bold tracking-wider text-gray-300">{m.name}</p>
                    <p className="mt-1 font-tech text-base text-gray-500">{m.desc}</p>
                    <p className="mt-2 font-mono text-xs tracking-wider text-gray-600">locked · check back later</p>
                    <div className="mt-4 flex items-center justify-between border-t border-cyber-border/50 pt-3 font-mono text-xs tracking-[0.15em]">
                      <span className="text-gray-600">{m.foot}</span>
                      <span className="font-bold text-amber/60">RESTRICTED // LOCKED</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <footer className="flex flex-col items-center justify-between gap-2 border-t border-cyber-border/70 pt-3 font-mono text-xs text-gray-400 md:flex-row">
              <div className="flex items-center gap-5">
                <span><span className="rounded border border-cyber-border px-1.5 py-0.5 text-cyber-cyan">[1-4]</span> Quick Select Mode</span>
                <span><span className="rounded border border-cyber-border px-1.5 py-0.5 text-cyber-cyan">[ESC]</span> Back to Title</span>
                <span className="hidden sm:inline"><span className="rounded border border-cyber-border px-1.5 py-0.5 text-cyber-cyan">[SPACE]</span> Launch Default</span>
              </div>
              <span className="tracking-[0.2em]">SFX: <span className="text-cyber-cyan">ENABLED</span></span>
            </footer>
          </>
        )}

        {/* ===== DIFFICULTY ===== */}
        {screen === "difficulty" && (
          <>
            <header className="flex items-center justify-between border-b border-cyber-border/70 pb-3">
              <div className="flex items-center gap-4">
                <div className="rounded-lg border border-cyber-cyan/50 bg-cyber-surface/90 px-3.5 py-1.5 font-display text-xl font-black tracking-widest text-white shadow-glowcyan">
                  Math<span className="text-cyber-cyan">REC</span>
                </div>
                <div className="hidden font-mono text-xs tracking-[0.2em] text-gray-400 sm:block">
                  SYSTEM // CLASSIC PROTOCOL <span className="text-cyber-cyan">▸</span>{" "}
                  <span className="font-semibold text-white">SELECT DIFFICULTY</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    clickSfx();
                    setScreen("modes");
                  }}
                  className="rounded border border-cyber-border bg-cyber-surface/80 px-3.5 py-1.5 font-mono text-xs tracking-[0.2em] text-gray-300 transition hover:border-cyber-cyan hover:text-cyber-cyan"
                >
                  ◂ ABORT TO MODES <span className="ml-1 rounded bg-black/40 px-1 text-gray-500">ESC</span>
                </button>
                <span className="hidden font-mono text-xs tracking-[0.2em] text-gray-500 md:inline">
                  <span className="text-mint">●</span> NET: STABLE
                </span>
              </div>
            </header>

            <section className="animate-pop mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-8">
              <h2 className="text-center font-display text-3xl font-bold tracking-wider text-white md:text-4xl">
                TARGET FREQUENCY <span className="text-cyber-cyan">&</span> CHALLENGE TIER
              </h2>
              <p className="mt-2 text-center font-mono text-xs tracking-[0.3em] text-gray-500">
                PRESS KEYS [1], [2], OR [3] FOR QUICK DEPLOYMENT
              </p>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d, i) => {
                  const cfg = DIFFICULTIES[d];
                  const accent =
                    d === "easy"
                      ? { text: "text-cyber-cyan", border: "hover:border-cyber-cyan/70", chip: "border-cyber-cyan/50 bg-cyber-cyan/10 text-cyber-cyan", mult: "text-cyber-cyan" }
                      : d === "medium"
                        ? { text: "text-amber", border: "hover:border-amber/70", chip: "border-amber/50 bg-amber/10 text-amber", mult: "text-amber" }
                        : { text: "text-crimson", border: "hover:border-crimson/70", chip: "border-crimson/50 bg-crimson/10 text-crimson", mult: "text-crimson" };
                  return (
                    <button
                      key={d}
                      onClick={() => startGame(d)}
                      className={`group rounded-xl border border-cyber-border/80 bg-cyber-surface/80 p-5 text-left transition ${accent.border}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-display text-2xl font-bold tracking-wider text-white">
                          <span className={`rounded border px-2 py-0.5 font-mono text-sm ${accent.chip}`}>{i + 1}</span>
                          {cfg.label}
                        </span>
                        <span className={`rounded border px-2.5 py-1 font-mono text-sm font-bold ${accent.chip}`}>
                          {cfg.timeLimit}s ⏱
                        </span>
                      </div>
                      <div className="mt-4 space-y-2.5 border-t border-cyber-border/60 pt-4 font-mono text-xs leading-relaxed tracking-wider text-gray-400">
                        <p><span className={accent.text}>▸</span> <span className="text-white">Operators:</span> {cfg.operators}</p>
                        <p><span className={accent.text}>▸</span> <span className="text-white">Range:</span> {cfg.range}</p>
                        <p><span className={accent.text}>▸</span> <span className="text-white">Cadence:</span> {cfg.cadence}</p>
                        <p>
                          <span className={accent.text}>▸</span> <span className="text-white">Score Multiplier:</span>{" "}
                          <span className={`font-bold ${accent.mult}`}>
                            {cfg.multiplier.toFixed(cfg.multiplier % 1 ? 2 : 1)}x{cfg.multiplier > 1 ? (d === "hard" ? " Hyper-Streak" : "") : ""}
                          </span>
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className={`font-mono text-xs font-bold tracking-[0.2em] ${accent.text}`}>ENGAGE TIER ▸</span>
                        <span className="font-mono text-xs text-gray-500">Record: {readBest(d).toLocaleString()} pts</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-xl border border-cyber-border/70 bg-black/30 p-5">
                <div className="flex items-center justify-between font-mono text-xs tracking-[0.25em]">
                  <span className="font-bold text-white">◼ PROTOCOL OPERATING RULES // TACTICAL INTEL</span>
                  <span className="hidden text-gray-500 sm:inline">STATUS: READY FOR EXECUTION</span>
                </div>
                <div className="mt-4 grid gap-4 font-mono text-xs leading-relaxed tracking-wider text-gray-400 md:grid-cols-3">
                  <div>
                    <p className="font-bold text-white">▸ 4 Choices Per Puzzle:</p>
                    <p className="mt-1">Single verified correct result per equation. Hotkeys [A-D] or numeric touch.</p>
                    <p className="mt-3 font-bold text-white">▸ Streak Escalation:</p>
                    <p className="mt-1">Consecutive rapid solutions trigger combo multipliers & bonus points.</p>
                  </div>
                  <div>
                    <p className="font-bold text-white">▸ 3 Lives (Shields):</p>
                    <p className="mt-1">Incorrect answer deducts 1 shield. Zero integrity terminates run.</p>
                    <p className="mt-3 font-bold text-white">▸ Data Persistence:</p>
                    <p className="mt-1">Personal bests saved per difficulty level.</p>
                  </div>
                  <div>
                    <p className="font-bold text-white">▸ Red Timer Bar:</p>
                    <p className="mt-1">Continuous drain per question. Full timeout penalizes 1 shield.</p>
                    <p className="mt-3 font-bold text-white">▸ Precision Tip:</p>
                    <p className="mt-1">Speed without precision exhausts lives rapidly on higher tiers.</p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ===== PLAYING ===== */}
        {screen === "playing" && question && (
          <>
            <header className="flex flex-col gap-3 border-b border-cyber-border/70 pb-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center justify-between gap-3 md:justify-start">
                <div className="flex items-center gap-2 rounded-lg border border-cyber-cyan/40 bg-cyber-surface/90 px-3.5 py-1.5 shadow-glowcyan">
                  <span className="h-2.5 w-2.5 animate-ping rounded-full bg-cyber-cyan" />
                  <span className="font-display text-xl font-black tracking-widest text-white">
                    Math<span className="text-cyber-cyan">REC</span>
                  </span>
                </div>
                <div className="rounded border border-crimson/50 bg-crimson/10 px-3 py-1.5 font-mono text-xs font-bold tracking-wider text-crimson">
                  PROTOCOL: {DIFFICULTIES[difficulty].label}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <div className="flex items-center gap-2 rounded-xl border border-cyber-border/80 bg-cyber-surface/70 px-4 py-2" aria-label="integrity">
                  <span className="mr-1 hidden font-mono text-xs tracking-widest text-gray-400 sm:inline">INTEGRITY</span>
                  {Array.from({ length: LIVES }).map((_, i) => (
                    <span
                      key={i}
                      className={`inline-block h-4 w-8 rounded-sm border ${
                        i < lives
                          ? "border-cyan-200 bg-cyber-cyan shadow-[0_0_12px_rgba(0,240,255,0.8)]"
                          : "border-white/10 bg-white/10"
                      }`}
                    />
                  ))}
                </div>
                <div className="text-right font-mono">
                  <p className="text-[10px] tracking-[0.25em] text-gray-500">MULTIPLIER</p>
                  <p className="text-lg font-bold text-amber">
                    {DIFFICULTIES[difficulty].multiplier.toFixed(DIFFICULTIES[difficulty].multiplier % 1 ? 2 : 1)}x
                  </p>
                </div>
                <div className="text-right font-mono">
                  <p className="text-[10px] tracking-[0.25em] text-gray-500">PHASE</p>
                  <p className="text-lg font-bold text-white">Q: {qNum}</p>
                </div>
                <div className="rounded-lg border border-amber/60 bg-amber/10 px-4 py-1.5 text-right shadow-[0_0_16px_rgba(255,184,0,0.25)]">
                  <p className="font-mono text-[10px] tracking-[0.25em] text-amber/80">SCORE</p>
                  <p className="text-glow-amber font-display text-2xl font-black tabular-nums text-amber">
                    {score.toLocaleString()}
                  </p>
                </div>
              </div>
            </header>

            {/* Timer strip */}
            <div className="mt-4">
              <div className="flex items-center justify-between font-mono text-xs font-bold tracking-[0.2em]">
                <span className={urgent && !reveal ? "text-crimson" : "text-cyber-cyan/80"}>
                  {urgent && !reveal ? "◷ SYSTEM TIMEOUT WARNING" : "◷ CHRONOMETER"}
                </span>
                <span className={urgent && !reveal ? "text-glow-crimson text-crimson" : "text-gray-300"}>
                  {secsLeft}.{Math.floor((timeLeft % 1000) / 100)}s
                </span>
              </div>
              <div
                className="mt-1.5 h-2.5 overflow-hidden rounded-full border border-cyber-border/80 bg-black/50"
                role="progressbar"
                aria-label="time left"
                aria-valuenow={secsLeft}
                aria-valuemin={0}
                aria-valuemax={DIFFICULTIES[difficulty].timeLimit}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
                    urgent && !reveal
                      ? "animate-pulse bg-gradient-to-r from-crimson via-rose-500 to-crimson shadow-glowbad"
                      : "bg-gradient-to-r from-cyber-cyan to-white shadow-glowcyan"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Question card */}
            <section className="mx-auto mt-6 w-full max-w-3xl flex-1">
              <div
                key={qNum}
                className={`tactical-corner animate-pop rounded-2xl border bg-cyber-surface/85 p-8 text-center backdrop-blur-md md:p-10 ${
                  reveal?.correct
                    ? "border-mint shadow-glowgood"
                    : reveal && !reveal.correct
                      ? "animate-shake border-crimson shadow-glowbad"
                      : "border-cyber-cyan/50 shadow-glowcyan"
                }`}
              >
                <span className="inline-block rounded-full border border-crimson/50 bg-crimson/10 px-4 py-1 font-mono text-xs tracking-[0.3em] text-crimson">
                  ● SPEED CALCULATION MATRIX
                </span>
                <p className="text-glow-white mt-6 font-display text-6xl font-black tracking-wider text-white md:text-7xl">
                  {question.text}
                </p>
                <div className="mt-6 border-t border-cyber-border/60 pt-4 font-mono text-xs tracking-[0.25em] md:text-sm">
                  {reveal?.correct ? (
                    <span className="font-bold text-mint">STATUS: VERIFIED · +{lastGain} PTS</span>
                  ) : reveal && !reveal.correct ? (
                    <span className="font-bold text-crimson">
                      {reveal.timeout ? "STATUS: TIMEOUT" : "STATUS: ERROR"} · CORRECT: {question.answer}
                    </span>
                  ) : (
                    <span>
                      <span className="text-crimson">STATUS: EVALUATING</span>
                      <span className="text-gray-600"> · </span>
                      <span className="text-cyber-cyan/80">PRESS KEYS [1, 2, 3, 4] OR TAP</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Answer matrix */}
              <div className="mt-6 grid grid-cols-2 gap-3 md:gap-4">
                {question.choices.map((c, i) => {
                  const isPicked = reveal?.picked === c;
                  const isAnswer = c === question.answer;
                  let cls = "border-cyber-border/70 bg-cyber-surface/70 hover:border-cyber-cyan/70 hover:shadow-glowcyan";
                  let num = "text-white";
                  if (reveal) {
                    if (isAnswer) {
                      cls = "border-mint bg-mint/10 shadow-glowgood";
                      num = "text-glow-mint text-mint";
                    } else if (isPicked) {
                      cls = "animate-shake border-crimson bg-crimson/10 shadow-glowbad";
                      num = "text-crimson";
                    } else cls = "border-cyber-border/40 bg-cyber-surface/40 opacity-50";
                  }
                  return (
                    <button
                      key={`${c}-${i}`}
                      onClick={() => answer(c)}
                      disabled={!!reveal}
                      className={`flex h-[72px] items-center gap-3 rounded-lg border px-4 transition active:scale-[0.98] disabled:cursor-default md:h-[88px] ${cls}`}
                    >
                      <span className="rounded border border-cyber-border bg-black/40 px-2 py-1 font-mono text-xs tracking-wider text-gray-400">
                        {KEY_HINTS[i]}
                      </span>
                      <span className={`flex-1 text-center font-display text-3xl font-bold tabular-nums md:text-4xl ${num}`}>
                        {c}
                      </span>
                      {reveal && isAnswer && (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-mint font-mono text-sm text-mint">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <footer className="mt-6 flex items-center justify-between font-mono text-xs text-gray-500">
              <button
                onClick={quitToModes}
                className="rounded border border-cyber-border bg-cyber-surface/80 px-3.5 py-1.5 tracking-[0.2em] text-gray-300 transition hover:border-cyber-cyan hover:text-cyber-cyan"
              >
                ← QUIT TO MODES <span className="ml-1 rounded bg-black/40 px-1">ESC</span>
              </button>
              <span className="hidden tracking-[0.3em] sm:inline">MATHREC · DARK CIRCUIT EDITION</span>
              <span className="tracking-[0.2em]">
                STREAK <span className="text-amber">×{streak}</span>
              </span>
            </footer>
          </>
        )}

        {/* ===== GAME OVER ===== */}
        {screen === "gameover" && (
          <>
            <header className="flex items-center justify-between border-b border-cyber-border/70 pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-cyber-border bg-cyber-surface/90 px-3.5 py-1.5 font-display text-xl font-black tracking-widest text-white">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-crimson shadow-glowbad" />
                  Math<span className="text-crimson">REC</span>
                </div>
                <span className="rounded border border-cyber-border px-2.5 py-1 font-mono text-xs tracking-[0.2em] text-gray-500">
                  V2.4.0-PRO
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-mint/50 bg-mint/10 px-4 py-1.5 font-mono text-xs tracking-[0.2em] text-mint">
                <span className="inline-block h-2 w-2 rounded-full bg-mint" /> SESSION COMPLETE
              </div>
            </header>

            <section className="animate-pop mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center py-8 text-center">
              <span className="rounded border border-crimson/50 bg-crimson/10 px-4 py-1 font-mono text-xs font-bold tracking-[0.3em] text-crimson">
                ● RUN TERMINATED
              </span>
              <h2 className="mt-4 font-display text-4xl font-black tracking-wider text-white md:text-5xl">
                DIFFICULTY:{" "}
                <span className="bg-gradient-to-r from-crimson to-amber bg-clip-text text-transparent">
                  {DIFFICULTIES[difficulty].label}
                </span>
              </h2>
              <p className="mt-2 font-mono text-xs tracking-[0.3em] text-gray-500">
                CALCULATED VECTORS PROCESSED · HIGH COMPLEXITY LEVEL
              </p>

              <div className="tactical-corner mt-6 w-full rounded-2xl border border-amber/50 bg-cyber-surface/85 p-6 shadow-[0_0_30px_rgba(255,184,0,0.2)] backdrop-blur-md md:p-8">
                <p className="font-mono text-xs font-bold tracking-[0.3em] text-amber">⚡ TOTAL SCORE REGISTERED</p>
                <p className="mt-2 font-display text-6xl font-black tabular-nums text-white md:text-7xl">
                  {score.toLocaleString()} <span className="text-glow-amber text-3xl text-amber md:text-4xl">PTS</span>
                </p>
                <p className="mx-auto mt-3 inline-block rounded-full border border-amber/40 px-4 py-1 font-mono text-xs tracking-[0.2em] text-amber">
                  ★ PERSONAL BEST: {Math.max(best, score).toLocaleString()} PTS{isNewBest ? " · NEW ALL-TIME HIGH" : " · ALL-TIME HIGH"}
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-cyber-border/60 pt-6 md:grid-cols-4">
                  {[
                    { label: "COMPLETED", value: String(answered), sub: "Questions Solved", cls: "text-white", subCls: "text-mint" },
                    { label: "ACCURACY", value: `${accuracy}%`, sub: `${correctCount} Correct / ${answered - correctCount} Missed`, cls: "text-cyber-cyan", subCls: "text-gray-400" },
                    { label: "MAX COMBO", value: `${maxStreak}x`, sub: "Streak Multiplier", cls: "text-amber", subCls: "text-amber/70" },
                    { label: "AVG SPEED", value: avgSpeed, sub: "Per Operation", cls: "text-white", subCls: "text-gray-400" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-cyber-border/60 bg-black/30 p-4">
                      <p className="font-mono text-[10px] tracking-[0.25em] text-gray-500">{s.label}</p>
                      <p className={`mt-2 font-display text-3xl font-black tabular-nums ${s.cls}`}>{s.value}</p>
                      <p className={`mt-1 font-mono text-[11px] tracking-wider ${s.subCls}`}>{s.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid w-full gap-3">
                <button
                  onClick={() => startGame(difficulty)}
                  className="rounded-xl border border-cyber-cyan bg-white px-5 py-4 font-display text-lg font-bold tracking-[0.25em] text-black transition hover:shadow-[0_0_35px_rgba(0,240,255,0.55)] active:scale-[0.99]"
                  style={{ boxShadow: "0 0 24px rgba(255,255,255,0.35)" }}
                >
                  ⟳ RETRY RUN
                </button>
                <button
                  onClick={() => {
                    clickSfx();
                    setScreen("difficulty");
                  }}
                  className="rounded-xl border border-cyber-border bg-cyber-surface/80 px-5 py-4 font-display text-lg font-bold tracking-[0.25em] text-white transition hover:border-cyber-cyan/70 active:scale-[0.99]"
                >
                  CHANGE DIFFICULTY
                </button>
              </div>
              <button
                onClick={() => {
                  clickSfx();
                  setScreen("title");
                }}
                className="mt-4 font-mono text-xs tracking-[0.3em] text-gray-500 transition hover:text-white"
              >
                MAIN MENU
              </button>
            </section>

            <footer className="flex items-center justify-between font-mono text-xs text-gray-500">
              <span className="tracking-[0.2em]">● INPUT CONTROLLER: KEYBOARD / NUMPAD ACTIVE</span>
              <span className="tracking-[0.15em]">
                HOTKEYS: <span className="rounded border border-cyber-border bg-cyber-surface px-1.5 py-0.5 text-gray-300">SPACE</span> RETRY{" "}
                <span className="rounded border border-cyber-border bg-cyber-surface px-1.5 py-0.5 text-gray-300">ESC</span> MENU
              </span>
            </footer>
          </>
        )}
      </div>
      {transitionTo && <PixelTransition key={transitionTo} />}
    </main>
  );
}
