import type { Mode } from "./modes";

export interface Question {
  text: string;
  answer: number;
  choices: number[];
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Difficulty tier from question level. Hardcore starts ~hard (+4 offset). */
function tier(level: number, hardcore: boolean): 0 | 1 | 2 {
  const eff = hardcore ? level + 4 : level;
  if (eff <= 3) return 0;
  if (eff <= 7) return 1;
  return 2;
}

/** Magnitude growth with level (1.0 → ~3). */
function mag(level: number): number {
  return Math.min(3, 1 + (level - 1) * 0.15);
}

function buildDistractors(answer: number): number[] {
  const set = new Set<number>([answer]);
  const candidates = [
    answer + 1,
    answer - 1,
    answer + 2,
    answer - 2,
    answer + 10,
    answer - 10,
    answer + rand(3, 9),
    answer - rand(3, 9),
    answer * 2,
    answer - rand(4, 12),
    answer + rand(4, 12),
  ];
  for (const c of candidates) {
    if (set.size >= 4) break;
    if (Number.isInteger(c) && !set.has(c)) set.add(c);
  }
  let guard = 0;
  while (set.size < 4 && guard < 100) {
    const c = answer + rand(-15, 15);
    if (!set.has(c)) set.add(c);
    guard++;
  }
  return shuffle(Array.from(set));
}

type Op = "+" | "-" | "×" | "÷" | "pow" | "root" | "percent";

function allowedOps(t: 0 | 1 | 2): Op[] {
  if (t === 0) return ["+", "-"];
  if (t === 1) return ["+", "-", "×", "÷"];
  return ["+", "-", "×", "÷", "pow", "root", "percent"];
}

/**
 * Generate a question for a mode at a 1-based level.
 * All answers are integers (calculator-safe). Negatives only when allowNegative.
 */
export function generateQuestion(mode: Mode, level: number): Question {
  const hardcore = mode === "hardcore";
  const allowNegative = mode === "calculator";
  const t = tier(level, hardcore);
  const s = mag(level);
  const op = pick(allowedOps(t));
  let answer = 0;
  let text = "";

  // Tier-2 random two-op chain (35%)
  if (t === 2 && Math.random() < 0.3) {
    const op2 = pick(["+", "-", "×"] as const);
    const a = rand(2, Math.round(10 * s));
    const b = rand(2, Math.round(8 * s));
    const c = rand(2, 9);
    const js = `${a} ${op2 === "×" ? "*" : op2} ${b} ${op2 === "×" ? "+" : op2} ${c}`;
    const val = Function(`"use strict"; return (${js})`)() as number;
    if (!Number.isInteger(val) || Math.abs(val) > 500 || (!allowNegative && val < 0)) {
      return generateQuestion(mode, level);
    }
    answer = val;
    const sym2 = op2 === "×" ? "×" : op2;
    const sym3 = op2 === "×" ? "+" : op2;
    text = `${a} ${sym2} ${b} ${sym3} ${c} = ?`;
    return { text, answer, choices: buildDistractors(answer) };
  }

  switch (op) {
    case "+": {
      const a = rand(2, Math.round(14 * s));
      const b = rand(2, Math.round(14 * s));
      answer = a + b;
      text = `${a} + ${b} = ?`;
      break;
    }
    case "-": {
      let a = rand(2, Math.round(16 * s));
      let b = rand(2, Math.round(16 * s));
      if (!allowNegative && b > a) [a, b] = [b, a];
      answer = a - b;
      text = `${a} − ${b} = ?`;
      break;
    }
    case "×": {
      const x = rand(2, Math.round(6 + 6 * s));
      const y = rand(2, Math.round(6 + 6 * s));
      answer = x * y;
      text = `${x} × ${y} = ?`;
      break;
    }
    case "÷": {
      const divisor = rand(2, Math.round(5 + 7 * s));
      const quotient = rand(2, Math.round(5 + 7 * s));
      answer = quotient;
      text = `${divisor * quotient} ÷ ${divisor} = ?`;
      break;
    }
    case "pow": {
      const exp = level >= 10 ? rand(2, 3) : 2;
      const baseMax = exp === 3 ? 5 : Math.min(12, 5 + level);
      const base = rand(2, baseMax);
      answer = Math.pow(base, exp);
      text = exp === 2 ? `${base}² = ?` : `${base}³ = ?`;
      break;
    }
    case "root": {
      const r = rand(2, Math.min(16, 8 + level));
      answer = r;
      text = `√${r * r} = ?`;
      break;
    }
    case "percent": {
      const p = pick([10, 20, 25, 50, 75]);
      const base = rand(1, Math.min(20, 4 + level)) * 20;
      answer = (base * p) / 100;
      text = `${p}% of ${base} = ?`;
      break;
    }
  }

  return { text, answer, choices: buildDistractors(answer) };
}
