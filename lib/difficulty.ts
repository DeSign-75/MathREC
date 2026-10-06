export type Difficulty = "easy" | "medium" | "hard";

export interface DifficultyConfig {
  label: string;
  ops: string[];
  min: number;
  max: number;
  allowMixed: boolean;
  description: string;
  timeLimit: number; // seconds per question
  multiplier: number; // score multiplier
  operators: string;
  range: string;
  cadence: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: "EASY",
    ops: ["+", "-"],
    min: 1,
    max: 12,
    allowMixed: false,
    description: "+  −  small numbers",
    timeLimit: 15,
    multiplier: 1.0,
    operators: "Addition & Subtraction (+ −)",
    range: "Small integers [ 1 − 20 ]",
    cadence: "Relaxed pace, low penalty hazard",
  },
  medium: {
    label: "MEDIUM",
    ops: ["+", "-", "×", "÷"],
    min: 2,
    max: 25,
    allowMixed: false,
    description: "+  −  ×  ÷",
    timeLimit: 10,
    multiplier: 1.75,
    operators: "4 Operations (+ − × ÷)",
    range: "Standard two-digit integers [ 10 − 99 ]",
    cadence: "Standard tempo, balanced pressure",
  },
  hard: {
    label: "HARD",
    ops: ["+", "-", "×", "÷"],
    min: 6,
    max: 60,
    allowMixed: true,
    description: "mixed + big numbers",
    timeLimit: 7,
    multiplier: 2.5,
    operators: "Complex & Mixed ( ) + − × ÷",
    range: "High-magnitude multi-digit challenges",
    cadence: "Reflex overdrive, rapid timeout danger",
  },
};

export const LIVES = 3;
export const BASE_POINTS = 10;
export const STREAK_BONUS = 2;
export const MAX_STREAK_BONUS = 20;
