import { DIFFICULTIES, type Difficulty } from "./difficulty";

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

function buildDistractors(answer: number, min: number, max: number): number[] {
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
    Math.max(min, answer - rand(4, 12)),
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

export function generateQuestion(difficulty: Difficulty): Question {
  const cfg = DIFFICULTIES[difficulty];
  const op = pick(cfg.ops);
  let a = rand(cfg.min, cfg.max);
  let b = rand(cfg.min, cfg.max);
  let answer = 0;
  let text = "";

  // On hard, sometimes chain two ops: e.g. "4 + 6 × 2"
  if (difficulty === "hard" && cfg.allowMixed && Math.random() < 0.35) {
    const op2 = pick(cfg.ops);
    const c = rand(2, 12);
    const expr = `${a} ${op} ${b} ${op2} ${c}`;
    // Evaluate safely by constructing numbers-only expression
    const js = expr.replace(/×/g, "*").replace(/÷/g, "/");
    const val = Function(`"use strict"; return (${js})`)() as number;
    if (!Number.isInteger(val) || Math.abs(val) > 500) return generateQuestion(difficulty);
    answer = val;
    text = `${a} ${op} ${b} ${op2} ${c} = ?`;
    return { text, answer, choices: buildDistractors(answer, -500, 500) };
  }

  switch (op) {
    case "+":
      answer = a + b;
      text = `${a} + ${b} = ?`;
      break;
    case "-":
      if (b > a) [a, b] = [b, a];
      answer = a - b;
      text = `${a} − ${b} = ?`;
      break;
    case "×": {
      // keep multiplication tables sane per difficulty
      const x = difficulty === "medium" ? rand(2, 12) : rand(3, 15);
      const y = difficulty === "medium" ? rand(2, 12) : rand(3, 15);
      answer = x * y;
      text = `${x} × ${y} = ?`;
      break;
    }
    case "÷": {
      // integer-only division: pick divisor & quotient, derive dividend
      const divisor = difficulty === "medium" ? rand(2, 12) : rand(3, 15);
      const quotient = difficulty === "medium" ? rand(2, 12) : rand(2, 20);
      const dividend = divisor * quotient;
      answer = quotient;
      text = `${dividend} ÷ ${divisor} = ?`;
      break;
    }
    default:
      answer = a + b;
      text = `${a} + ${b} = ?`;
  }

  return { text, answer, choices: buildDistractors(answer, -100, 1000) };
}
