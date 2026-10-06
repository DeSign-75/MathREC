// Synthesized sound effects for MathREC (Web Audio, zero assets).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ensure(): boolean {
  if (typeof window === "undefined") return false;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  return true;
}

/** Call from a user gesture. Creates/resumes the context (browsers block audio before interaction). */
export function unlockAudio() {
  if (!ensure() || !ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
}

interface ToneOpts {
  freq: number;
  end?: number;
  at?: number;
  dur?: number;
  type?: OscillatorType;
  vol?: number;
}

function tone({ freq, end, at, dur = 0.15, type = "square", vol = 0.12 }: ToneOpts) {
  if (!ctx || !master) return;
  const t0 = at ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (end !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// ---- SFX ----
export function clickSfx() {
  if (!ensure()) return;
  tone({ freq: 700, dur: 0.05, vol: 0.06 });
}

export function correctSfx() {
  if (!ensure()) return;
  const t = ctx!.currentTime;
  tone({ freq: 523.25, dur: 0.12, vol: 0.12, at: t });
  tone({ freq: 783.99, dur: 0.2, vol: 0.12, at: t + 0.09 });
}

export function wrongSfx() {
  if (!ensure()) return;
  tone({ freq: 150, end: 90, dur: 0.3, type: "sawtooth", vol: 0.14 });
}

export function timeoutSfx() {
  if (!ensure()) return;
  tone({ freq: 400, end: 120, dur: 0.45, vol: 0.13 });
}

export function tickSfx() {
  if (!ensure()) return;
  tone({ freq: 1000, dur: 0.05, vol: 0.07 });
}

export function gameOverSfx() {
  if (!ensure()) return;
  const t = ctx!.currentTime;
  tone({ freq: 392, dur: 0.22, type: "triangle", vol: 0.12, at: t });
  tone({ freq: 311.13, dur: 0.22, type: "triangle", vol: 0.12, at: t + 0.16 });
  tone({ freq: 261.63, dur: 0.34, type: "triangle", vol: 0.12, at: t + 0.32 });
}

/** Retro boot jingle — plays on first interaction after load. */
export function welcomeSfx() {
  if (!ensure()) return;
  const t = ctx!.currentTime;
  const notes = [262.63, 329.63, 392, 523.25, 783.99];
  notes.forEach((freq, i) => {
    tone({ freq, dur: 0.14, vol: 0.1, at: t + i * 0.09 });
  });
}

/** Pixel-transition sweep — rising zip into the mode select. */
export function sweepSfx() {
  if (!ensure()) return;
  tone({ freq: 180, end: 1400, dur: 0.5, type: "sawtooth", vol: 0.07 });
}

/** Kabooom detonation — noise burst + sub sweep. */
export function explodeSfx() {
  if (!ensure()) return;
  const t = ctx!.currentTime;
  tone({ freq: 120, end: 28, dur: 0.7, type: "sawtooth", vol: 0.2 });
  const len = Math.floor(ctx!.sampleRate * 0.5);
  const buf = ctx!.createBuffer(1, len, ctx!.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx!.createBufferSource();
  src.buffer = buf;
  const g = ctx!.createGain();
  g.gain.value = 0.25;
  src.connect(g);
  g.connect(master!);
  src.start(t);
}
