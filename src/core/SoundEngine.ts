const SOUND_STORAGE_KEY = 'starc_sound_enabled';

/**
 * Lightweight, zero-dependency Web Audio synthesizer for celestial feedback.
 * Lazily unlocks on first user gesture and never throws in restricted environments.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;

  // Continuous subtle alignment resonance drone (active only during ALIGN_PUZZLE)
  private droneOscA: OscillatorNode | null = null;
  private droneOscB: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;
  private isDroneActive: boolean = false;

  // Track last integer second ticked below 5s
  private lastTickSecond: number = -1;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(SOUND_STORAGE_KEY);
        if (saved !== null) {
          this.enabled = saved === 'true';
        }
      } catch {}
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
      } catch {}
    }
    if (!enabled) {
      this.stopResonance();
    } else {
      this.unlock();
    }
  }

  public unlock(): void {
    if (!this.enabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.ctx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.22;
        this.masterGain.connect(this.ctx.destination);
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {}
  }

  private ensureReady(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  /**
   * Soft crystalline chime on target lock (PREVIEW)
   */
  public playPreviewLock(): void {
    const ctx = this.ensureReady();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const freqs = [523.25, 783.99]; // C5 + G5
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.16, now + idx * 0.06 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.48);
    });
  }

  /**
   * Subtle deep-space glide when displacing into 3D orbit (DISPLACE)
   */
  public playDisplaceWhoosh(): void {
    const ctx = this.ensureReady();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + 0.55);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.55);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  /**
   * Continuous harmonic resonance that softly rises in pitch & clarity as alignment approaches 96%+
   */
  public updateResonance(accuracy: number, isAligning: boolean): void {
    if (!isAligning || !this.enabled) {
      if (this.isDroneActive) {
        this.stopResonance();
      }
      return;
    }

    const ctx = this.ensureReady();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;

    if (!this.droneOscA || !this.droneOscB || !this.droneFilter || !this.droneGain) {
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      oscA.type = 'sine';
      oscB.type = 'triangle';
      oscA.frequency.value = 220;
      oscB.frequency.value = 330;

      filter.type = 'lowpass';
      filter.frequency.value = 360;
      filter.Q.value = 1.2;

      gain.gain.value = 0.0001;

      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      oscA.start(now);
      oscB.start(now);

      this.droneOscA = oscA;
      this.droneOscB = oscB;
      this.droneFilter = filter;
      this.droneGain = gain;
    }

    this.isDroneActive = true;

    // Gentle ramp starting above 45% alignment; blossoms smoothly approaching 96%
    const norm = Math.max(0, Math.min(1, (accuracy - 45) / 51));
    const curved = norm * norm;

    const baseFreq = 196 + curved * 196; // G3 -> G4
    this.droneOscA.frequency.setTargetAtTime(baseFreq, now, 0.07);
    this.droneOscB.frequency.setTargetAtTime(baseFreq * 1.498, now, 0.07); // Pure fifth
    this.droneFilter.frequency.setTargetAtTime(320 + curved * 1100, now, 0.07);
    this.droneGain.gain.setTargetAtTime(curved > 0.01 ? 0.015 + curved * 0.13 : 0.0001, now, 0.08);
  }

  public stopResonance(): void {
    this.isDroneActive = false;
    this.lastTickSecond = -1;
    if (!this.ctx || !this.droneGain) return;
    try {
      const now = this.ctx.currentTime;
      this.droneGain.gain.setTargetAtTime(0.0001, now, 0.05);
    } catch {}
  }

  /**
   * Subtle countdown pulse each second under 5.0s
   */
  public checkLowTimeTick(timeLeftSec: number): void {
    if (timeLeftSec <= 0 || timeLeftSec > 5.0) {
      this.lastTickSecond = -1;
      return;
    }
    const secCeil = Math.ceil(timeLeftSec);
    if (secCeil === this.lastTickSecond) return;
    this.lastTickSecond = secCeil;

    const ctx = this.ensureReady();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const freq = secCeil <= 2 ? 880 : 660;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  /**
   * Radiant celestial chord on alignment lock (RESOLVED)
   */
  public playSolvedChord(): void {
    this.stopResonance();
    const ctx = this.ensureReady();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    // Ethereal Cmaj9 arpeggio
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16 / (1 + idx * 0.12), start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.95);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 1.0);
    });
  }

  /**
   * Soft muted descending tone on timeout
   */
  public playTimeoutTone(): void {
    this.stopResonance();
    const ctx = this.ensureReady();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [392.0, 293.66]; // G4 -> D4
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  }

  public dispose(): void {
    this.stopResonance();
    try {
      this.droneOscA?.stop();
      this.droneOscB?.stop();
    } catch {}
    this.droneOscA = null;
    this.droneOscB = null;
    this.droneFilter = null;
    this.droneGain = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
    }
  }
}

export const soundEngine = new SoundEngine();
