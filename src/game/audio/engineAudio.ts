// Synthesized car audio for the player's car: engine (follows rpm), tyre/gravel roll, skid hiss, impacts.
// Browser only; created after a user gesture (the click that started the race).
export type Surface = "gravel" | "dirt" | "snow";

const SURFACE_BAND: Record<Surface, { freq: number; q: number; gain: number }> = {
  gravel: { freq: 900, q: 0.8, gain: 0.5 },
  dirt: { freq: 600, q: 0.7, gain: 0.45 },
  snow: { freq: 380, q: 1.2, gain: 0.4 },
};

function noiseBuffer(ctx: AudioContext) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    last = last * 0.6 + w * 0.4; // slightly brown: less hiss
    d[i] = last;
  }
  return b;
}

export class EngineAudio {
  private ctx: AudioContext;
  private master: GainNode;
  private oscA: OscillatorNode;
  private oscB: OscillatorNode;
  private engineFilter: BiquadFilterNode;
  private engineGain: GainNode;
  private roadGain: GainNode;
  private roadFilter: BiquadFilterNode;
  private skidGain: GainNode;
  private noise: AudioBuffer;
  private lastImpact = 0;

  constructor(surface: Surface) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    // Engine: saw + square an octave down, through a resonant low-pass, lightly saturated.
    this.oscA = ctx.createOscillator();
    this.oscA.type = "sawtooth";
    this.oscB = ctx.createOscillator();
    this.oscB.type = "square";
    const mixB = ctx.createGain();
    mixB.gain.value = 0.5;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.Q.value = 3;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(x * 2.2); }
    shaper.curve = curve;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.oscA.connect(this.engineFilter);
    this.oscB.connect(mixB).connect(this.engineFilter);
    this.engineFilter.connect(shaper).connect(this.engineGain).connect(this.master);
    this.oscA.start();
    this.oscB.start();

    // Road + skid noise.
    this.noise = noiseBuffer(ctx);
    const road = ctx.createBufferSource();
    road.buffer = this.noise;
    road.loop = true;
    const band = SURFACE_BAND[surface];
    this.roadFilter = ctx.createBiquadFilter();
    this.roadFilter.type = "bandpass";
    this.roadFilter.frequency.value = band.freq;
    this.roadFilter.Q.value = band.q;
    this.roadGain = ctx.createGain();
    this.roadGain.gain.value = 0;
    road.connect(this.roadFilter).connect(this.roadGain).connect(this.master);
    road.start();

    const skid = ctx.createBufferSource();
    skid.buffer = this.noise;
    skid.loop = true;
    skid.playbackRate.value = 1.7;
    const skidF = ctx.createBiquadFilter();
    skidF.type = "bandpass";
    skidF.frequency.value = surface === "snow" ? 700 : 1400;
    skidF.Q.value = 1.4;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    skid.connect(skidF).connect(this.skidGain).connect(this.master);
    skid.start();
    void ctx.resume();
  }

  update(o: { rpm: number; throttle: number; speed: number; slip: number; onRoad: boolean; impact: number; paused: boolean }) {
    const t = this.ctx.currentTime;
    const tc = 0.05;
    if (o.paused) {
      this.master.gain.setTargetAtTime(0, t, 0.05);
      return;
    }
    this.master.gain.setTargetAtTime(0.55, t, 0.1);
    const f = (o.rpm / 60) * 2; // 4-cylinder firing frequency
    this.oscA.frequency.setTargetAtTime(f, t, tc);
    this.oscB.frequency.setTargetAtTime(f / 2, t, tc);
    this.engineFilter.frequency.setTargetAtTime(300 + o.rpm * 0.32 + o.throttle * 900, t, tc);
    this.engineGain.gain.setTargetAtTime(0.06 + o.throttle * 0.08 + (o.rpm / 7400) * 0.05, t, tc);
    const sp = Math.min(1, Math.abs(o.speed) / 40);
    this.roadGain.gain.setTargetAtTime(sp * (o.onRoad ? 0.35 : 0.6), t, 0.08);
    this.roadFilter.frequency.setTargetAtTime((o.onRoad ? 1 : 0.7) * this.roadFilter.frequency.value, t, 0.2);
    const skid = Math.min(1, Math.max(0, Math.abs(o.slip) - 0.12) * 3) * Math.min(1, Math.abs(o.speed) / 12);
    this.skidGain.gain.setTargetAtTime(skid * 0.35, t, 0.06);
    if (o.impact > 4 && t - this.lastImpact > 0.25) {
      this.lastImpact = t;
      this.thud(Math.min(1, o.impact / 20));
    }
  }

  private thud(strength: number) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 500;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.9 * strength, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.4);
  }

  dispose() {
    void this.ctx.close();
  }
}
