export type SoundKind = 'exit' | 'blocked' | 'win' | 'lose';

/** One note: start offset in seconds, frequency in Hz, length, wave and loudness. */
interface Note {
  readonly at: number;
  readonly freq: number;
  readonly len: number;
  readonly wave: OscillatorType;
  readonly gain: number;
  /** Frequency the note glides to, if any. */
  readonly to?: number;
}

/** All sounds are made here with oscillators, so no audio files ship (N-5). */
const NOTES: Readonly<Record<SoundKind, readonly Note[]>> = {
  exit: [{ at: 0, freq: 380, to: 760, len: 0.14, wave: 'sine', gain: 0.12 }],
  blocked: [
    { at: 0, freq: 160, to: 90, len: 0.18, wave: 'square', gain: 0.07 },
  ],
  win: [
    { at: 0, freq: 523, len: 0.18, wave: 'triangle', gain: 0.14 },
    { at: 0.12, freq: 659, len: 0.18, wave: 'triangle', gain: 0.14 },
    { at: 0.24, freq: 784, len: 0.18, wave: 'triangle', gain: 0.14 },
    { at: 0.36, freq: 1047, len: 0.4, wave: 'triangle', gain: 0.14 },
  ],
  lose: [
    { at: 0, freq: 330, len: 0.2, wave: 'triangle', gain: 0.14 },
    { at: 0.18, freq: 262, len: 0.2, wave: 'triangle', gain: 0.14 },
    { at: 0.36, freq: 196, len: 0.45, wave: 'triangle', gain: 0.14 },
  ],
};

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: typeof AudioContext | undefined =
    typeof AudioContext === 'undefined' ? undefined : AudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** Plays a short synthesized sound. Does nothing when audio is missing or blocked. */
export function playSound(kind: SoundKind): void {
  const c = context();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const start = c.currentTime;
  for (const n of NOTES[kind]) {
    const osc = c.createOscillator();
    const amp = c.createGain();
    const t0 = start + n.at;
    osc.type = n.wave;
    osc.frequency.setValueAtTime(n.freq, t0);
    if (n.to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(n.to, t0 + n.len);
    }
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(n.gain, t0 + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + n.len);
    osc.connect(amp).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + n.len + 0.02);
  }
}
