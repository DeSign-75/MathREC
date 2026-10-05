export type Difficulty = "easy" | "medium" | "hard";

export interface DifficultyConfig {
  label: string;
  ops: string[];
  min: number;
  max: number;
  allowMixed: boolean;
  description: string;
  timeLimit: number; // seconds per question
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
  },
  medium: {
    label: "MEDIUM",
    ops: ["+", "-", "×", "÷"],
    min: 2,
    max: 25,
    allowMixed: false,
    description: "+  −  ×  ÷",
    timeLimit: 10,
  },
  hard: {
    label: "HARD",
    ops: ["+", "-", "×", "÷"],
    min: 6,
    max: 60,
    allowMixed: true,
    description: "mixed + big numbers",
    timeLimit: 7,
  },
};

export const LIVES = 3;
export const BASE_POINTS = 10;
export const STREAK_BONUS = 2;
export const MAX_STREAK_BONUS = 20;
