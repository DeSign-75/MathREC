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

function bestKey(d: Difficulty) {
  return `mathrec-best-${d}`;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("title");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [mode, setMode] = useState<"classic">("classic");
  const [question, setQuestion] = useState<Question | null>(null);
  const [qNum, setQNum] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [reveal, setReveal] = useState<Reveal>(null);
  const [best, setBest] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [transitionTo, setTransitionTo] = useState<Screen | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadline = useRef<number>(0);
  const timeoutRef = useRef<() => void>(() => {});
  const lastTick = useRef(-1);
  const welcomed = useRef(false);

  const loadBest = useCallback((d: Difficulty) => {
    try {
      setBest(Number(localStorage.getItem(bestKey(d)) ?? 0) || 0);
    } catch {
      setBest(0);
    }
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
    loadBest(d);
    setScore(0);
    setStreak(0);
    setLives(LIVES);
    setQNum(1);
    setReveal(null);
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

  const miss = (picked: number | null, timedOut: boolean) => {
    if (timedOut) timeoutSfx();
    else wrongSfx();
    const remaining = lives - 1;
    setLives(remaining);
    setStreak(0);
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
      miss(null, true);
    };
  });

  // Per-question countdown — red bar. Stops once an answer is revealed.
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
    const correct = choice === question.answer;

    if (correct) {
      correctSfx();
      const bonus = Math.min(streak * STREAK_BONUS, MAX_STREAK_BONUS);
      const gained = BASE_POINTS + bonus;
      const newScore = score + gained;
      setScore(newScore);
      setStreak(streak + 1);
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
      miss(choice, false);
    }
  };

  return (
    <main className="grid-bg min-h-screen bg-void font-robo text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1
            className="animate-pulse-glow rounded-lg border border-white/25 bg-panel/80 px-4 py-2 text-xl font-extrabold tracking-[0.25em]"
            style={{ textShadow: "0 0 12px rgba(255,255,255,0.8)" }}
          >
            MathREC
          </h1>
          <div className="flex items-center gap-2">
            {screen === "playing" && (
              <div className="rounded-lg border border-score/40 bg-panel/80 px-4 py-2 text-right shadow-glow">
                <div className="text-[10px] tracking-[0.3em] text-white/60">SCORE</div>
                <div className="text-2xl font-extrabold text-score" style={{ textShadow: "0 0 14px rgba(255,214,10,0.7)" }}>
                  {score}
                </div>
              </div>
            )}
          </div>
        </header>

        {screen === "title" && (
          <section className="animate-pop flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm tracking-[0.5em] text-white/50">DARK CIRCUIT EDITION</p>
            <h2
              className="mt-4 text-7xl font-extrabold tracking-[0.08em]"
              style={{ textShadow: "0 0 24px rgba(255,255,255,0.7), 0 0 70px rgba(255,255,255,0.25)" }}
            >
              MathREC
            </h2>
            <p className="mt-4 font-mono2 text-sm tracking-[0.25em] text-white/55">
              4 CHOICES · 3 LIVES · BEAT THE TIMER
            </p>
            <button
              onClick={() => goWithTransition("modes")}
              className="animate-blink mt-10 rounded-xl border border-white/60 bg-white px-12 py-4 text-xl font-extrabold tracking-[0.3em] text-black shadow-glow transition hover:shadow-glow active:scale-95"
            >
              ▶ START
            </button>
          </section>
        )}

        {screen === "modes" && (
          <section className="animate-pop mt-10 flex flex-1 flex-col">
            <p className="text-center text-sm tracking-[0.35em] text-white/60">SELECT GAME MODE</p>
            <div className="mt-8 grid gap-3">
              <button
                onClick={() => {
                  clickSfx();
                  setMode("classic");
                  setScreen("difficulty");
                }}
                className="group rounded-xl border border-white/40 bg-panel/90 px-5 py-4 text-left shadow-glow transition hover:border-white/80"
              >
                <span className="flex items-center justify-between">
                  <span className="text-lg font-bold tracking-[0.2em]">CLASSIC</span>
                  <span className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white">▶</span>
                </span>
                <span className="mt-1 block font-mono2 text-sm tracking-wider text-white/55">
                  4 choices · 3 lives · red timer bar
                </span>
              </button>
              {["TIME ATTACK", "SURVIVAL"].map((name) => (
                <div
                  key={name}
                  className="rounded-xl border border-white/10 bg-panel/60 px-5 py-4 text-left opacity-50"
                  aria-disabled="true"
                >
                  <span className="flex items-center justify-between">
                    <span className="text-lg font-bold tracking-[0.2em] text-white/60">{name}</span>
                    <span className="font-mono2 text-xs tracking-[0.25em] text-white/40">🔒 COMING SOON</span>
                  </span>
                  <span className="mt-1 block font-mono2 text-sm tracking-wider text-white/35">
                    locked · check back later
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                clickSfx();
                setScreen("title");
              }}
              className="mx-auto mt-6 font-mono2 text-xs tracking-[0.3em] text-white/40 hover:text-white"
            >
              ← BACK
            </button>
          </section>
        )}

        {screen === "difficulty" && (
          <section className="animate-pop mt-10 flex flex-1 flex-col">
            <p className="text-center text-sm tracking-[0.35em] text-white/60">
              {mode === "classic" ? "CLASSIC · " : ""}SELECT DIFFICULTY
            </p>
            <div className="mt-8 grid gap-3">
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => startGame(d)}
                  className="group rounded-xl border border-white/20 bg-panel/90 px-5 py-4 text-left shadow-glow transition hover:border-white/70 hover:shadow-glow"
                >
                  <span className="flex items-center justify-between">
                    <span className="text-lg font-bold tracking-[0.2em]">{DIFFICULTIES[d].label}</span>
                    <span className="font-mono2 text-sm tracking-widest text-bad">
                      {DIFFICULTIES[d].timeLimit}s <span className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white">▶</span>
                    </span>
                  </span>
                  <span className="mt-1 block font-mono2 text-sm tracking-wider text-white/55">
                    {DIFFICULTIES[d].description}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 font-mono2 text-sm leading-relaxed text-white/60">
              ▸ 4 choices per puzzle
              <br />▸ {LIVES} lives — wrong answer costs 1
              <br />▸ Red timer bar — timeout costs 1 life
              <br />▸ Streaks earn bonus points
              <br />▸ Best score saved per difficulty
            </div>
            <button
              onClick={() => {
                clickSfx();
                setScreen("modes");
              }}
              className="mx-auto mt-6 font-mono2 text-xs tracking-[0.3em] text-white/40 hover:text-white"
            >
              ← BACK TO MODES
            </button>
          </section>
        )}

        {screen === "playing" && question && (
          <section className="mt-6 flex flex-1 flex-col">
            {/* Status row: lives + streak + q count */}
            <div className="flex items-center justify-between font-mono2 text-sm tracking-widest text-white/70">
              <div className="flex gap-1.5" aria-label="lives">
                {Array.from({ length: LIVES }).map((_, i) => (
                  <span
                    key={i}
                    className={`inline-block h-3 w-8 rounded-sm border ${
                      i < lives ? "border-white bg-white shadow-glow" : "border-white/20 bg-white/10"
                    }`}
                  />
                ))}
              </div>
              <span>
                <span className="text-bad">⏱ {Math.ceil(timeLeft / 1000)}s</span> · Q{qNum} · STREAK{" "}
                <span className="text-score">×{streak}</span>
              </span>
            </div>

            {/* Red timer bar */}
            {(() => {
              const total = DIFFICULTIES[difficulty].timeLimit * 1000;
              const pct = Math.max(0, Math.min(100, (timeLeft / total) * 100));
              const urgent = timeLeft <= 3000 && !reveal;
              return (
                <div
                  className="mt-3 h-2.5 overflow-hidden rounded-full border border-bad/40 bg-bad/10"
                  role="progressbar"
                  aria-label="time left"
                  aria-valuenow={Math.ceil(timeLeft / 1000)}
                  aria-valuemin={0}
                  aria-valuemax={DIFFICULTIES[difficulty].timeLimit}
                >
                  <div
                    className={`h-full rounded-full bg-bad transition-[width] duration-100 ease-linear ${
                      urgent ? "animate-pulse" : ""
                    }`}
                    style={{ width: `${pct}%`, boxShadow: "0 0 12px rgba(255,59,92,0.8)" }}
                  />
                </div>
              );
            })()}

            {/* Question card */}
            <div
              key={qNum}
              className={`animate-pop mt-4 rounded-2xl border bg-panel/90 p-8 text-center shadow-glow ${
                reveal?.correct
                  ? "border-good shadow-glowgood"
                  : reveal && !reveal.correct
                    ? "animate-shake border-bad shadow-glowbad"
                    : "border-white/25"
              }`}
            >
              <p className="text-xs tracking-[0.35em] text-white/50">{DIFFICULTIES[difficulty].label} MODE</p>
              <p className="mt-3 text-5xl font-extrabold tracking-wider" style={{ textShadow: "0 0 20px rgba(255,255,255,0.45)" }}>
                {question.text}
              </p>
              {reveal && !reveal.correct && (
                <p className="mt-3 font-mono2 text-sm tracking-widest text-bad">
                  {reveal.timeout ? "TIME UP — " : ""}CORRECT: {question.answer}
                </p>
              )}
              {reveal?.correct && (
                <p className="mt-3 font-mono2 text-sm tracking-widest text-good">
                  +{BASE_POINTS + Math.min((streak - 1) * STREAK_BONUS, MAX_STREAK_BONUS)} CORRECT
                </p>
              )}
            </div>

            {/* Choices */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              {question.choices.map((c) => {
                const isPicked = reveal?.picked === c;
                const isAnswer = c === question.answer;
                let cls = "border-white/20 bg-panel/90 hover:border-white/80 hover:shadow-glow";
                if (reveal) {
                  if (isAnswer) cls = "border-good bg-good/15 text-good shadow-glowgood";
                  else if (isPicked) cls = "border-bad bg-bad/15 text-bad shadow-glowbad";
                  else cls = "border-white/10 bg-panel/60 text-white/40";
                }
                return (
                  <button
                    key={c}
                    onClick={() => answer(c)}
                    disabled={!!reveal}
                    className={`rounded-xl border px-4 py-5 text-2xl font-bold tracking-widest shadow-glow transition active:scale-95 disabled:cursor-default ${cls}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>

            <button
              onClick={quitToModes}
              className="mx-auto mt-6 font-mono2 text-xs tracking-[0.3em] text-white/40 hover:text-white"
            >
              QUIT TO MODES
            </button>
          </section>
        )}

        {screen === "gameover" && (
          <section className="animate-pop mt-10 flex flex-1 flex-col items-center text-center">
            <p className="text-sm tracking-[0.35em] text-bad">GAME OVER</p>
            <h2 className="mt-2 text-4xl font-extrabold" style={{ textShadow: "0 0 18px rgba(255,255,255,0.5)" }}>
              {DIFFICULTIES[difficulty].label}
            </h2>
            <div className="mt-6 w-full rounded-2xl border border-score/40 bg-panel/90 p-6 shadow-glow">
              <p className="text-xs tracking-[0.35em] text-white/50">FINAL SCORE</p>
              <p className="mt-1 text-6xl font-extrabold text-score" style={{ textShadow: "0 0 22px rgba(255,214,10,0.7)" }}>
                {score}
              </p>
              <p className="mt-2 font-mono2 text-sm tracking-widest text-white/60">
                BEST: <span className="text-score">{best}</span> · {qNum} QUESTIONS
              </p>
            </div>
            <div className="mt-6 grid w-full gap-3">
              <button
                onClick={() => startGame(difficulty)}
                className="rounded-xl border border-white/60 bg-white px-5 py-4 font-bold tracking-[0.25em] text-black shadow-glow transition hover:shadow-glow active:scale-95"
              >
                RETRY
              </button>
              <button
                onClick={() => {
                  clickSfx();
                  setScreen("difficulty");
                }}
                className="rounded-xl border border-white/25 bg-panel/90 px-5 py-4 font-bold tracking-[0.25em] shadow-glow transition hover:border-white/70 active:scale-95"
              >
                CHANGE DIFFICULTY
              </button>
            </div>
          </section>
        )}

        <footer className="mt-8 text-center font-mono2 text-[11px] tracking-[0.3em] text-white/30">
          MathREC · DARK CIRCUIT EDITION
        </footer>
      </div>
      {transitionTo && <PixelTransition key={transitionTo} />}
    </main>
  );
}
