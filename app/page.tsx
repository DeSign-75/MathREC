"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MODES, MODE_ORDER, bestKey, qTimeLimit, type Mode } from "../lib/modes";
import { generateQuestion, type Question } from "../lib/questions";
import {
  clickSfx,
  correctSfx,
  explodeSfx,
  gameOverSfx,
  sweepSfx,
  tickSfx,
  timeoutSfx,
  unlockAudio,
  welcomeSfx,
  wrongSfx,
} from "../lib/sound";
import PixelTransition from "../components/PixelTransition";

type Screen = "title" | "modes" | "playing" | "gameover";
type Reveal = { picked: number | null; correct: boolean; timeout?: boolean } | null;
type EndReason = "wiped" | "fuse" | "time";

const KEY_HINTS = ["A / 1", "B / 2", "C / 3", "D / 4"];
const STREAK_BONUS = 25;
const MAX_STREAK_BONUS = 250;

function readBest(m: Mode): number {
  try {
    return Number(localStorage.getItem(bestKey(m)) ?? 0) || 0;
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
  const [mode, setMode] = useState<Mode>("classic");
  const [question, setQuestion] = useState<Question | null>(null);
  const [qNum, setQNum] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(MODES.classic.lives);
  const [reveal, setReveal] = useState<Reveal>(null);
  const [best, setBest] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [clockLeft, setClockLeft] = useState(0);
  const [clockFlash, setClockFlash] = useState(false);
  const [clockDelta, setClockDelta] = useState<{ id: number; text: string; good: boolean } | null>(null);
  const [entry, setEntry] = useState("");
  const [transitionTo, setTransitionTo] = useState<Screen | null>(null);
  const [endReason, setEndReason] = useState<EndReason>("wiped");
  // Run stats
  const [answered, setAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [runBest, setRunBest] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  // Session stats (title footer)
  const [sessionBest, setSessionBest] = useState(0);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [sessionFastest, setSessionFastest] = useState(0);
  const [operatorId] = useState(() => `GUEST-${Math.floor(1000 + Math.random() * 9000)}`);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadline = useRef<number>(0);
  const clockDeadline = useRef<number>(0);
  const qStart = useRef<number>(0);
  const timeoutRef = useRef<() => void>(() => {});
  const lastTick = useRef(-1);
  const welcomed = useRef(false);
  const fastestRef = useRef(0);
  const deltaId = useRef(0);
  const keyHandler = useRef((_e: KeyboardEvent) => {});

  const cfg = MODES[mode];
  const qLimit = qTimeLimit(mode, qNum);
  const hasQClock = qLimit > 0;
  const hasTotalClock = (cfg.totalTime ?? 0) > 0;

  const loadBest = useCallback((m: Mode) => {
    setBest(readBest(m));
  }, []);

  useEffect(() => {
    loadBest(mode);
  }, [mode, loadBest]);

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

  const startGame = (m: Mode) => {
    unlockAudio();
    clickSfx();
    setMode(m);
    setRunBest(readBest(m));
    loadBest(m);
    setScore(0);
    setStreak(0);
    setLives(MODES[m].lives);
    setQNum(1);
    setReveal(null);
    setEntry("");
    setAnswered(0);
    setCorrectCount(0);
    setMaxStreak(0);
    setTotalMs(0);
    setClockFlash(false);
    setClockDelta(null);
    setEndReason("wiped");
    fastestRef.current = 0;
    clockDeadline.current = 0;
    qStart.current = Date.now();
    setQuestion(generateQuestion(m, 1));
    setScreen("playing");
  };

  const nextQuestion = useCallback(
    (qCount: number) => {
      setQNum(qCount);
      setReveal(null);
      setEntry("");
      qStart.current = Date.now();
      setQuestion(generateQuestion(mode, qCount));
    },
    [mode]
  );

  const quitToModes = () => {
    clickSfx();
    if (timer.current) clearTimeout(timer.current);
    setReveal(null);
    setEntry("");
    setScreen("modes");
  };

  const endRun = (reason: EndReason) => {
    if (timer.current) clearTimeout(timer.current);
    setEndReason(reason);
    if (reason === "fuse") explodeSfx();
    else gameOverSfx();
    setScreen("gameover");
  };

  const flashClock = (text: string, good: boolean) => {
    setClockFlash(true);
    deltaId.current += 1;
    setClockDelta({ id: deltaId.current, text, good });
    setTimeout(() => {
      setClockFlash(false);
      setClockDelta(null);
    }, 900);
  };

  const elapsedMs = () => {
    if (hasQClock) {
      const total = qLimit * 1000;
      return Math.min(total, Math.max(0, total - (deadline.current - Date.now())));
    }
    return Math.max(0, Date.now() - qStart.current);
  };

  const gainedFor = (streakVal: number, frac: number) =>
    Math.round(100 + 900 * frac + Math.min(streakVal * STREAK_BONUS, MAX_STREAK_BONUS));

  const applyCorrect = (ms: number) => {
    correctSfx();
    const frac = hasQClock ? timeLeft / (qLimit * 1000) : Math.max(0, 1 - ms / (cfg.scoringWindow * 1000));
    const gained = gainedFor(streak, frac);
    setLastGain(gained);
    const newScore = score + gained;
    setScore(newScore);
    const newStreak = streak + 1;
    setStreak(newStreak);
    setMaxStreak((m) => Math.max(m, newStreak));
    setAnswered((a) => a + 1);
    setCorrectCount((c) => c + 1);
    setTotalMs((t) => t + ms);
    if (fastestRef.current === 0 || ms < fastestRef.current) fastestRef.current = ms;
    if (cfg.clockBonusSec) {
      clockDeadline.current = Math.min(
        Date.now() + (cfg.clockCapSec ?? 99) * 1000,
        clockDeadline.current + cfg.clockBonusSec * 1000
      );
      setClockLeft(Math.max(0, clockDeadline.current - Date.now()));
      flashClock(`+${cfg.clockBonusSec}s`, true);
    }
    setReveal({ picked: null, correct: true });
    if (newScore > best) {
      setBest(newScore);
      try {
        localStorage.setItem(bestKey(mode), String(newScore));
      } catch {
        /* ignore */
      }
    }
    timer.current = setTimeout(() => nextQuestion(qNum + 1), 750);
  };

  const miss = (picked: number | null, timedOut: boolean, ms: number) => {
    if (timedOut) timeoutSfx();
    else wrongSfx();
    setAnswered((a) => a + 1);
    setTotalMs((t) => t + ms);
    if (cfg.lives > 0) {
      const remaining = lives - 1;
      setLives(remaining);
      setStreak(0);
      setReveal({ picked, correct: false, timeout: timedOut });
      if (remaining <= 0) {
        timer.current = setTimeout(() => endRun("wiped"), 1100);
      } else {
        timer.current = setTimeout(() => nextQuestion(qNum + 1), 1100);
      }
    } else {
      // Clock modes: wrong answers drain the clock
      const pen = (cfg.clockPenaltySec ?? 0) * 1000;
      clockDeadline.current -= pen;
      setClockLeft(Math.max(0, clockDeadline.current - Date.now()));
      flashClock(`−${cfg.clockPenaltySec}s`, false);
      setStreak(0);
      setReveal({ picked, correct: false, timeout: timedOut });
      timer.current = setTimeout(() => {
        if (clockDeadline.current - Date.now() <= 0) endRun(mode === "kabooom" ? "fuse" : "time");
        else nextQuestion(qNum + 1);
      }, 1100);
    }
  };

  // Always point the countdown at the latest game state (avoids stale closures)
  useEffect(() => {
    timeoutRef.current = () => {
      if (screen !== "playing" || !question || reveal) return;
      miss(null, true, qLimit * 1000);
    };
  });

  // Per-question countdown. Stops once an answer is revealed.
  useEffect(() => {
    if (screen !== "playing" || !question || reveal || !hasQClock) return;
    const total = qLimit * 1000;
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
  }, [screen, question, qNum, mode, reveal, hasQClock, qLimit]);

  // Total-clock countdown (time attack / kabooom). Pauses while feedback shows.
  useEffect(() => {
    if (screen !== "playing" || !question || reveal || !hasTotalClock) return;
    if (clockDeadline.current === 0) {
      clockDeadline.current = Date.now() + (cfg.totalTime ?? 0) * 1000;
    }
    setClockLeft(Math.max(0, clockDeadline.current - Date.now()));
    const id = setInterval(() => {
      const remaining = clockDeadline.current - Date.now();
      if (remaining <= 0) {
        clearInterval(id);
        setClockLeft(0);
        endRun(mode === "kabooom" ? "fuse" : "time");
      } else {
        setClockLeft(remaining);
        if (mode === "kabooom" && remaining <= 5000) tickSfxThrottled();
      }
    }, 100);
    return () => clearInterval(id);
  }, [screen, question, qNum, mode, reveal, hasTotalClock]);

  const answer = (choice: number) => {
    if (screen !== "playing" || !question || reveal) return;
    if (choice === question.answer) applyCorrect(elapsedMs());
    else miss(choice, false, elapsedMs());
  };

  // ---- Calculator numpad ----
  const pressKey = (d: string) => {
    if (screen !== "playing" || !question || reveal) return;
    clickSfx();
    const digits = entry.startsWith("-") ? entry.length - 1 : entry.length;
    if (digits >= 6) return;
    setEntry((e) => (e === "0" ? d : e + d));
  };
  const pressNegate = () => {
    if (screen !== "playing" || !question || reveal) return;
    clickSfx();
    setEntry((e) => (e.startsWith("-") ? e.slice(1) : e === "" ? "-" : `-${e}`));
  };
  const pressBack = () => {
    if (screen !== "playing" || !question || reveal) return;
    setEntry((e) => e.slice(0, -1));
  };
  const pressClear = () => {
    if (screen !== "playing" || !question || reveal) return;
    setEntry("");
  };
  const submitEntry = () => {
    if (screen !== "playing" || !question || reveal) return;
    if (entry === "" || entry === "-") return;
    answer(parseInt(entry, 10));
  };

  // Keyboard controls — latest state via ref, single listener
  keyHandler.current = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === " ") e.preventDefault();
    if (screen === "title") {
      if (k === " " || k === "enter") goWithTransition("modes");
    } else if (screen === "modes") {
      const idx = ["1", "2", "3", "4", "5"].indexOf(k);
      if (idx >= 0) startGame(MODE_ORDER[idx]);
      else if (k === " " || k === "enter") startGame("classic");
      else if (k === "escape") setScreen("title");
    } else if (screen === "playing") {
      if (k === "escape") quitToModes();
      else if (question && !reveal) {
        if (cfg.input === "numpad") {
          if (/^[0-9]$/.test(k)) pressKey(k);
          else if (k === "backspace") pressBack();
          else if (k === "enter") submitEntry();
          else if (k === "-" || k === "_") pressNegate();
        } else {
          const idx = ["1", "2", "3", "4", "a", "b", "c", "d"].indexOf(k) % 4;
          if (["1", "2", "3", "4", "a", "b", "c", "d"].includes(k)) answer(question.choices[idx]);
        }
      }
    } else if (screen === "gameover") {
      if (k === " " || k === "enter") startGame(mode);
      else if (k === "escape") setScreen("modes");
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pct = hasQClock ? Math.max(0, Math.min(100, (timeLeft / (qLimit * 1000)) * 100)) : 0;
  const urgent = hasQClock && pct <= 25;
  const secsLeft = Math.ceil(timeLeft / 1000);
  const clockTotal = (cfg.totalTime ?? 0) * 1000;
  const clockPct = clockTotal > 0 ? Math.max(0, Math.min(100, (clockLeft / clockTotal) * 100)) : 0;
  const accuracy = answered > 0 ? Math.round((correctCount / answered) * 100) : 0;
  const avgSpeed = answered > 0 ? `${(totalMs / answered / 1000).toFixed(2)}s` : "—";
  const isNewBest = score > runBest && score > 0;

  return (
    <main className="grid-bg relative min-h-screen overflow-x-hidden bg-void font-tech text-white [touch-action:manipulation]">
      <div className="scanlines pointer-events-none fixed inset-0 z-30 opacity-60" />
      <div className="vignette pointer-events-none fixed inset-0 z-30" />
      {/* HUD corner reticles */}
      <div className="pointer-events-none fixed left-4 top-4 z-30 h-8 w-8 border-l-2 border-t-2 border-cyber-cyan/60" />
      <div className="pointer-events-none fixed right-4 top-4 z-30 h-8 w-8 border-r-2 border-t-2 border-cyber-cyan/60" />
      <div className="pointer-events-none fixed bottom-4 left-4 z-30 h-8 w-8 border-b-2 border-l-2 border-cyber-cyan/60" />
      <div className="pointer-events-none fixed bottom-4 right-4 z-30 h-8 w-8 border-b-2 border-r-2 border-cyber-cyan/60" />

      <div className="relative z-20 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:px-6 md:py-5">
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

            <section className="animate-pop relative flex flex-1 flex-col items-center justify-center py-6 text-center md:py-10">
              <div className="hero-halo animate-pulse-aura pointer-events-none absolute left-1/2 top-1/2 h-[350px] w-[650px] max-w-full rounded-full bg-cyber-cyan/15 blur-[110px]" />
              <div className="relative rounded-full border border-cyber-cyan/40 bg-cyber-cyan/10 px-5 py-1.5 font-mono text-xs tracking-[0.3em] text-cyber-cyan">
                NEURAL SPEED ARITHMETIC ENGINE
              </div>
              <h1 className="hero-title relative mt-6 font-display text-5xl font-black tracking-wide sm:text-7xl md:text-8xl">
                <span className="text-glow-white text-white">Math</span>
                <span className="text-glow-cyan text-cyber-cyan">REC</span>
              </h1>
              <p className="hero-sub relative mt-4 font-mono text-xs tracking-[0.4em] text-gray-400 sm:text-sm">
                [ DARK CIRCUIT EDITION ]
              </p>
              <div className="hero-sub relative mt-6 flex flex-wrap items-center justify-center gap-3 font-mono text-xs tracking-[0.2em] sm:text-sm">
                <span className="rounded border border-cyber-border bg-cyber-surface/80 px-3 py-1 text-cyber-cyan">
                  5 MODES
                </span>
                <span className="rounded border border-cyber-border bg-cyber-surface/80 px-3 py-1 text-crimson">
                  SPEED SCORING
                </span>
                <span className="rounded border border-cyber-border bg-cyber-surface/80 px-3 py-1 text-amber">
                  BEAT THE BEST
                </span>
              </div>
              <button
                onClick={() => goWithTransition("modes")}
                className="hero-cta relative mt-8 flex items-center gap-3 rounded-xl border border-cyber-cyan bg-white px-8 py-4 font-display text-lg font-bold tracking-[0.25em] text-black transition hover:shadow-[0_0_35px_rgba(0,240,255,0.55)] active:scale-95 sm:mt-10 sm:px-12 sm:text-xl"
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
              <h2 className="text-glow-white mt-2 text-center font-display text-3xl font-black tracking-wider text-white sm:text-4xl md:text-5xl">
                DEPLOY EXECUTION VECTOR
              </h2>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {MODE_ORDER.map((m, i) => {
                  const c = MODES[m];
                  const primary = m === "classic";
                  return (
                    <button
                      key={m}
                      onClick={() => startGame(m)}
                      className={`group rounded-xl border-2 bg-cyber-surface/90 p-5 text-left transition md:p-6 ${
                        primary
                          ? "border-cyber-cyan shadow-glowcyan hover:shadow-[0_0_35px_rgba(0,240,255,0.4)]"
                          : "border-cyber-border/80 hover:border-cyber-cyan/60 hover:shadow-glowcyan"
                      } ${m === "kabooom" ? "md:col-span-2" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 rounded border border-cyber-cyan/60 bg-cyber-cyan/10 px-2.5 py-1 font-mono text-xs tracking-[0.2em] text-cyber-cyan">
                          {c.tag} <span className="inline-block h-2 w-2 rounded-full bg-mint" />
                        </span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyber-cyan font-mono text-xs font-bold text-black shadow-glowcyan transition group-hover:scale-110 md:h-10 md:w-10 md:text-sm">
                          {i + 1}▶
                        </span>
                      </div>
                      <p className="mt-4 font-display text-2xl font-bold tracking-wider text-white md:mt-5 md:text-3xl">{c.label}</p>
                      <p className="mt-1 font-tech text-base text-gray-300">{c.description}</p>
                      <p className="mt-2 font-mono text-xs tracking-wider">
                        <span className="text-cyber-cyan">{c.params}</span>
                      </p>
                      <div className="mt-4 flex items-center justify-between border-t border-cyber-border/70 pt-3 font-mono text-xs tracking-[0.15em]">
                        <span className="text-gray-500">
                          SPEED: <span className="text-white">{c.speed}</span>
                          <span className="ml-3">RECORD: <span className="text-amber">{readBest(m).toLocaleString()}</span></span>
                        </span>
                        <span className="font-bold text-cyber-cyan">ENGAGE →</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <footer className="flex flex-col items-center justify-between gap-2 border-t border-cyber-border/70 pt-3 font-mono text-xs text-gray-400 md:flex-row">
              <div className="flex items-center gap-5">
                <span><span className="rounded border border-cyber-border px-1.5 py-0.5 text-cyber-cyan">[1-5]</span> Quick Select Mode</span>
                <span><span className="rounded border border-cyber-border px-1.5 py-0.5 text-cyber-cyan">[ESC]</span> Back to Title</span>
                <span className="hidden sm:inline"><span className="rounded border border-cyber-border px-1.5 py-0.5 text-cyber-cyan">[SPACE]</span> Launch Default</span>
              </div>
              <span className="tracking-[0.2em]">SFX: <span className="text-cyber-cyan">ENABLED</span></span>
            </footer>
          </>
        )}

        {/* ===== PLAYING ===== */}
        {screen === "playing" && question && (
          <>
            <header className="sticky top-0 z-40 -mx-4 flex flex-col gap-2 border-b border-cyber-border/70 bg-void/85 px-4 pb-3 pt-4 backdrop-blur-md sm:gap-3 md:-mx-6 md:flex-row md:items-center md:justify-between md:px-6">
              <div className="flex items-center justify-between gap-2 md:justify-start md:gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-cyber-cyan/40 bg-cyber-surface/90 px-2.5 py-1 shadow-glowcyan sm:px-3.5 sm:py-1.5">
                  <span className="h-2 w-2 animate-ping rounded-full bg-cyber-cyan sm:h-2.5 sm:w-2.5" />
                  <span className="font-display text-base font-black tracking-widest text-white sm:text-xl">
                    Math<span className="text-cyber-cyan">REC</span>
                  </span>
                </div>
                <div className="rounded border border-crimson/50 bg-crimson/10 px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-crimson sm:px-3 sm:py-1.5 sm:text-xs">
                  PROTOCOL: {cfg.label}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 md:justify-end md:gap-3">
                {cfg.lives > 0 && (
                  <div className="flex items-center gap-1.5 rounded-xl border border-cyber-border/80 bg-cyber-surface/70 px-2.5 py-1.5 sm:gap-2 sm:px-4 sm:py-2" aria-label="integrity">
                    <span className="mr-1 hidden font-mono text-xs tracking-widest text-gray-400 sm:inline">INTEGRITY</span>
                    {Array.from({ length: cfg.lives }).map((_, i) => (
                      <span
                        key={i}
                        className={`inline-block h-3 w-6 rounded-sm border sm:h-4 sm:w-8 ${
                          i < lives
                            ? "border-cyan-200 bg-cyber-cyan shadow-[0_0_12px_rgba(0,240,255,0.8)]"
                            : "border-white/10 bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                )}
                <div className="hidden text-right font-mono min-[420px]:block">
                  <p className="text-[10px] tracking-[0.25em] text-gray-500">BEST</p>
                  <p className="text-sm font-bold tabular-nums text-white sm:text-lg">{Math.max(best, score).toLocaleString()}</p>
                </div>
                <div className="text-right font-mono">
                  <p className="text-[10px] tracking-[0.25em] text-gray-500">PHASE</p>
                  <p className="text-sm font-bold text-white sm:text-lg">Q: {qNum}</p>
                </div>
                <div className="rounded-lg border border-amber/60 bg-amber/10 px-3 py-1 text-right shadow-[0_0_16px_rgba(255,184,0,0.25)] sm:px-4 sm:py-1.5">
                  <p className="font-mono text-[10px] tracking-[0.25em] text-amber/80">SCORE</p>
                  <p className="text-glow-amber font-display text-xl font-black tabular-nums text-amber sm:text-2xl">
                    {score.toLocaleString()}
                  </p>
                </div>
              </div>
            </header>

            {/* Per-question timer strip */}
            {hasQClock && (
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
                  aria-valuemax={qLimit}
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
            )}

            {/* Total-clock strip (time attack / kabooom) */}
            {hasTotalClock && (
              <div className="mt-4">
                <div className="flex items-center justify-between font-mono text-xs font-bold tracking-[0.2em]">
                  <span className={mode === "kabooom" ? "text-amber" : "text-cyber-cyan/80"}>
                    {mode === "kabooom" ? "💣 FUSE" : "◷ TOTAL REMAINING"}
                  </span>
                  <span className="flex items-center gap-2">
                    {clockDelta && (
                      <span key={clockDelta.id} className={`animate-pop ${clockDelta.good ? "text-mint" : "text-crimson"}`}>
                        {clockDelta.text}
                      </span>
                    )}
                    <span className={clockFlash ? "text-crimson" : "text-gray-300"}>
                      {(clockLeft / 1000).toFixed(1)}s
                    </span>
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2.5 overflow-hidden rounded-full border border-cyber-border/80 bg-black/50"
                  role="progressbar"
                  aria-label="clock remaining"
                  aria-valuenow={Math.ceil(clockLeft / 1000)}
                  aria-valuemin={0}
                  aria-valuemax={cfg.totalTime}
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
                      mode === "kabooom"
                        ? "bg-gradient-to-r from-amber via-orange-500 to-crimson shadow-glowbad"
                        : "bg-gradient-to-r from-cyber-cyan to-white shadow-glowcyan"
                    }`}
                    style={{ width: `${clockPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Question card */}
            <section className="mx-auto mt-6 w-full max-w-3xl flex-1">
              <div
                key={qNum}
                className={`tactical-corner animate-pop rounded-2xl border bg-cyber-surface/85 p-5 text-center backdrop-blur-md sm:p-8 md:p-10 ${
                  reveal?.correct
                    ? "border-mint shadow-glowgood"
                    : reveal && !reveal.correct
                      ? "animate-shake border-crimson shadow-glowbad"
                      : "border-cyber-cyan/50 shadow-glowcyan"
                }`}
              >
                <span className="inline-block rounded-full border border-crimson/50 bg-crimson/10 px-3 py-1 font-mono text-[10px] tracking-[0.3em] text-crimson sm:px-4 sm:text-xs">
                  ● {cfg.statusPill}
                </span>
                <p className="text-glow-white mt-4 font-display text-4xl font-black leading-tight tracking-wider text-white sm:mt-6 sm:text-5xl md:text-7xl">
                  {question.text}
                </p>
                <div className="mt-4 border-t border-cyber-border/60 pt-4 font-mono text-[10px] tracking-[0.25em] sm:mt-6 sm:text-xs md:text-sm">
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
                      <span className="text-cyber-cyan/80">
                        {cfg.input === "numpad" ? "TYPE ANSWER + [ENTER] OR TAP SUBMIT" : "PRESS KEYS [1, 2, 3, 4] OR TAP"}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Answer matrix (choices modes) */}
              {cfg.input === "choices" && (
                <div className="mt-5 grid select-none grid-cols-2 gap-2.5 sm:mt-6 md:gap-4">
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
                        className={`flex min-h-[64px] items-center gap-2 rounded-lg border px-3 transition active:scale-[0.98] disabled:cursor-default sm:h-[72px] sm:gap-3 sm:px-4 md:h-[88px] ${cls}`}
                      >
                        <span className="rounded border border-cyber-border bg-black/40 px-2 py-1 font-mono text-xs tracking-wider text-gray-400">
                          {KEY_HINTS[i]}
                        </span>
                        <span className={`flex-1 text-center font-display text-2xl font-bold tabular-nums sm:text-3xl md:text-4xl ${num}`}>
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
              )}

              {/* Numpad (calculator mode) */}
              {cfg.input === "numpad" && (
                <div className="mx-auto mt-5 max-w-md select-none sm:mt-6">
                  <div
                    className={`rounded-xl border bg-black/50 px-4 py-3 text-right font-display text-3xl font-bold tabular-nums tracking-wider sm:px-6 sm:py-4 sm:text-4xl ${
                      reveal?.correct
                        ? "border-mint text-mint shadow-glowgood"
                        : reveal && !reveal.correct
                          ? "border-crimson text-crimson shadow-glowbad"
                          : "border-cyber-cyan/50 text-white shadow-glowcyan"
                    }`}
                  >
                    {entry === "" ? <span className="text-gray-600">—</span> : entry}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2.5">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                      <button
                        key={d}
                        onClick={() => pressKey(d)}
                        disabled={!!reveal}
                        className="rounded-lg border border-cyber-border/70 bg-cyber-surface/70 py-5 font-display text-2xl font-bold text-white transition hover:border-cyber-cyan/70 hover:shadow-glowcyan active:scale-95 disabled:cursor-default disabled:opacity-50"
                      >
                        {d}
                      </button>
                    ))}
                    <button
                      onClick={pressNegate}
                      disabled={!!reveal}
                      className="rounded-lg border border-cyber-border/70 bg-cyber-surface/70 py-5 font-mono text-xl font-bold text-cyber-cyan transition hover:border-cyber-cyan/70 active:scale-95 disabled:cursor-default disabled:opacity-50"
                    >
                      ±
                    </button>
                    <button
                      onClick={() => pressKey("0")}
                      disabled={!!reveal}
                      className="rounded-lg border border-cyber-border/70 bg-cyber-surface/70 py-5 font-display text-2xl font-bold text-white transition hover:border-cyber-cyan/70 hover:shadow-glowcyan active:scale-95 disabled:cursor-default disabled:opacity-50"
                    >
                      0
                    </button>
                    <button
                      onClick={pressBack}
                      disabled={!!reveal}
                      className="rounded-lg border border-cyber-border/70 bg-cyber-surface/70 py-5 font-mono text-xl font-bold text-gray-300 transition hover:border-cyber-cyan/70 active:scale-95 disabled:cursor-default disabled:opacity-50"
                    >
                      ⌫
                    </button>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                    <button
                      onClick={pressClear}
                      disabled={!!reveal}
                      className="rounded-lg border border-crimson/50 bg-crimson/10 py-3.5 font-mono text-sm font-bold tracking-[0.2em] text-crimson transition hover:border-crimson active:scale-95 disabled:cursor-default disabled:opacity-50"
                    >
                      CLEAR
                    </button>
                    <button
                      onClick={submitEntry}
                      disabled={!!reveal}
                      className="col-span-2 rounded-lg border border-cyber-cyan bg-white py-3.5 font-display text-lg font-bold tracking-[0.25em] text-black transition hover:shadow-[0_0_25px_rgba(0,240,255,0.5)] active:scale-[0.98] disabled:cursor-default disabled:opacity-50"
                      style={{ boxShadow: "0 0 18px rgba(0,240,255,0.35)" }}
                    >
                      SUBMIT ⏎
                    </button>
                  </div>
                </div>
              )}
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
                {endReason === "fuse" ? "💥 FUSE DEPLETED" : endReason === "time" ? "◷ TIME EXPIRED" : "● RUN TERMINATED"}
              </span>
              <h2 className="mt-4 font-display text-3xl font-black tracking-wider text-white sm:text-4xl md:text-5xl">
                MODE:{" "}
                <span className="bg-gradient-to-r from-crimson to-amber bg-clip-text text-transparent">
                  {cfg.label}
                </span>
              </h2>
              <p className="mt-2 font-mono text-xs tracking-[0.3em] text-gray-500">
                CALCULATED VECTORS PROCESSED · HIGH COMPLEXITY LEVEL
              </p>

              <div className="tactical-corner mt-6 w-full rounded-2xl border border-amber/50 bg-cyber-surface/85 p-6 shadow-[0_0_30px_rgba(255,184,0,0.2)] backdrop-blur-md md:p-8">
                <p className="font-mono text-xs font-bold tracking-[0.3em] text-amber">⚡ TOTAL SCORE REGISTERED</p>
                <p className="mt-2 font-display text-5xl font-black tabular-nums text-white sm:text-6xl md:text-7xl">
                  {score.toLocaleString()} <span className="text-glow-amber text-2xl text-amber sm:text-3xl md:text-4xl">PTS</span>
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
                  onClick={() => startGame(mode)}
                  className="rounded-xl border border-cyber-cyan bg-white px-5 py-4 font-display text-lg font-bold tracking-[0.25em] text-black transition hover:shadow-[0_0_35px_rgba(0,240,255,0.55)] active:scale-[0.99]"
                  style={{ boxShadow: "0 0 24px rgba(255,255,255,0.35)" }}
                >
                  ⟳ RETRY RUN
                </button>
                <button
                  onClick={() => {
                    clickSfx();
                    setScreen("modes");
                  }}
                  className="rounded-xl border border-cyber-border bg-cyber-surface/80 px-5 py-4 font-display text-lg font-bold tracking-[0.25em] text-white transition hover:border-cyber-cyan/70 active:scale-[0.99]"
                >
                  CHANGE MODE
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

// Throttled fuse tick (kabooom < 5s): at most one blip per second
let lastFuseTick = 0;
function tickSfxThrottled() {
  const now = Date.now();
  if (now - lastFuseTick >= 1000) {
    lastFuseTick = now;
    tickSfx();
  }
}
