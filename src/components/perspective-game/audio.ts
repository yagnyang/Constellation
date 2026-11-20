class PerspectiveAudio {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  private resonanceOsc: OscillatorNode | null = null;
  private resonanceGain: GainNode | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Harmonic resonance that responds to perspective alignment percentage (0..1)
  updateResonance(accuracy0to1: number) {
    if (!this.enabled || accuracy0to1 < 0.35) {
      this.stopResonance();
      return;
    }
    this.initCtx();
    if (!this.ctx) return;

    if (!this.resonanceOsc) {
      this.resonanceOsc = this.ctx.createOscillator();
      this.resonanceGain = this.ctx.createGain();

      this.resonanceOsc.type = 'sine';
      this.resonanceOsc.frequency.setValueAtTime(260, this.ctx.currentTime);
      this.resonanceGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

      this.resonanceOsc.connect(this.resonanceGain);
      this.resonanceGain.connect(this.ctx.destination);
      this.resonanceOsc.start();
    }

    // Frequency smoothly shifts from 260Hz up to 523Hz (C5) at 100%
    const targetFreq = 260 + Math.pow(accuracy0to1, 2) * 320;
    const targetGain = Math.min(0.08, (accuracy0to1 - 0.35) * 0.12);

    this.resonanceOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);
    this.resonanceGain?.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
  }

  stopResonance() {
    if (this.resonanceGain && this.ctx) {
      this.resonanceGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
      const osc = this.resonanceOsc;
      setTimeout(() => {
        try { osc?.stop(); } catch {}
      }, 200);
      this.resonanceOsc = null;
      this.resonanceGain = null;
    }
  }

  // Satisfying magnetic perspective lock snap sound
  playSnapSound() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    // Dual chime snap
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  // Celestial chord on level completion
  playVictoryFanfare() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    this.stopResonance();

    // Ethereal celestial chord (C5, E5, G5, B5, D6)
    const freqs = [523.25, 659.25, 783.99, 987.77, 1174.66];
    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);

      const startTime = this.ctx.currentTime + idx * 0.08;
      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 1.8);
    });
  }

  // Scramble / warp whoosh
  playScrambleSound() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    this.stopResonance();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.6);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.6);
  }
}

export const puzzleAudio = new PerspectiveAudio();
