export type Mode = "classic" | "timeattack" | "hardcore" | "calculator" | "kabooom";

export type InputKind = "choices" | "numpad";

export interface ModeConfig {
  label: string;
  tag: string;
  description: string;
  params: string;
  lives: number; // 0 = no lives system (clock/fuse modes)
  input: InputKind;
  // Per-question timer curve: start − stepBy every stepEvery questions, floored at min.
  // stepBy 0 = fixed. qTimeStart 0 = no per-question clock.
  qTimeStart: number;
  qTimeStepEvery: number;
  qTimeStepBy: number;
  qTimeMin: number;
  // Total-clock modes (seconds)
  totalTime?: number;
  clockPenaltySec?: number; // deducted on wrong answer
  clockBonusSec?: number; // added on correct answer
  clockCapSec?: number;
  // Reference window (seconds) for the 100 + 900 × speed formula when no per-Q clock
  scoringWindow: number;
  statusPill: string;
  speed: string;
  difficulty: string;
}

export const MODES: Record<Mode, ModeConfig> = {
  classic: {
    label: "CLASSIC",
    tag: "PRIMARY PROTOCOL [1]",
    description: "Standard Rapid Arithmetic Evaluation",
    params: "4 choices · 3 lives · decaying timer",
    lives: 3,
    input: "choices",
    qTimeStart: 10,
    qTimeStepEvery: 5,
    qTimeStepBy: 1,
    qTimeMin: 5,
    scoringWindow: 10,
    statusPill: "SPEED CALCULATION MATRIX",
    speed: "NORMAL",
    difficulty: "ADAPTIVE",
  },
  timeattack: {
    label: "TIME ATTACK",
    tag: "PROTOCOL [2]",
    description: "60-second rapid frenzy; solve as many equations as possible.",
    params: "4 choices · 60s clock · wrong −3s",
    lives: 0,
    input: "choices",
    qTimeStart: 0,
    qTimeStepEvery: 1,
    qTimeStepBy: 0,
    qTimeMin: 0,
    totalTime: 60,
    clockPenaltySec: 3,
    scoringWindow: 8,
    statusPill: "RAPID FRENZY PROTOCOL",
    speed: "BLITZ",
    difficulty: "ESCALATING",
  },
  hardcore: {
    label: "HARDCORE",
    tag: "PROTOCOL [3]",
    description: "One life, brutal tempo, starts hard and keeps climbing.",
    params: "4 choices · 1 life · 5s per equation",
    lives: 1,
    input: "choices",
    qTimeStart: 5,
    qTimeStepEvery: 1,
    qTimeStepBy: 0,
    qTimeMin: 5,
    scoringWindow: 5,
    statusPill: "SUDDEN STRAIN PROTOCOL",
    speed: "OVERDRIVE",
    difficulty: "BRUTAL+",
  },
  calculator: {
    label: "CALCULATOR",
    tag: "PROTOCOL [4]",
    description: "No choices — punch exact answers into the numpad.",
    params: "numpad · 3 lives · 12s decaying timer",
    lives: 3,
    input: "numpad",
    qTimeStart: 12,
    qTimeStepEvery: 5,
    qTimeStepBy: 1,
    qTimeMin: 7,
    scoringWindow: 12,
    statusPill: "PRECISION INPUT MATRIX",
    speed: "DELIBERATE",
    difficulty: "COMPLEX",
  },
  kabooom: {
    label: "KABOOOM",
    tag: "PROTOCOL [5]",
    description: "Ticking fuse. Correct +2s, wrong −5s. Don't let it hit zero.",
    params: "4 choices · 10s fuse · +2s / −5s",
    lives: 0,
    input: "choices",
    qTimeStart: 0,
    qTimeStepEvery: 1,
    qTimeStepBy: 0,
    qTimeMin: 0,
    totalTime: 10,
    clockPenaltySec: 5,
    clockBonusSec: 2,
    clockCapSec: 15,
    scoringWindow: 6,
    statusPill: "VOLATILE ORDNANCE PROTOCOL",
    speed: "CRITICAL",
    difficulty: "VOLATILE",
  },
};

export const MODE_ORDER: Mode[] = ["classic", "timeattack", "hardcore", "calculator", "kabooom"];

/** Per-question time limit in seconds (0 = no per-question clock). qNum is 1-based. */
export function qTimeLimit(mode: Mode, qNum: number): number {
  const c = MODES[mode];
  if (c.qTimeStart <= 0) return 0;
  const steps = Math.floor((qNum - 1) / c.qTimeStepEvery);
  return Math.max(c.qTimeMin, c.qTimeStart - steps * c.qTimeStepBy);
}

export function bestKey(mode: Mode): string {
  return `mathrec-best-${mode}`;
}
