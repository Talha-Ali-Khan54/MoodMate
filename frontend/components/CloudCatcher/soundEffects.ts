"use client";

class SoundManager {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private getAudioContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === "undefined") return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  // Soothing pentatonic star chime (notes: C5, D5, E5, G5, A5, C6)
  playStarChime(starIndex: number = 0) {
    if (this.muted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
      const freq = scale[starIndex % scale.length];

      const now = ctx.currentTime;

      // Primary gentle chime oscillator
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(freq, now);

      // Warm harmonic overtone (fifth above, soft)
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(freq * 1.5, now);

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.95);
      osc2.stop(now + 0.95);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // Uplifting, warm chord swell when the sky clears completely
  playSunriseCelebration() {
    if (this.muted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const chord = [261.63, 329.63, 392.0, 523.25, 659.25]; // C major 7 warm chord
      const now = ctx.currentTime;

      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.001, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.08 + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.08);
        osc.stop(now + 2.6);
      });
    } catch {
      // Ignore
    }
  }
}

export const soundManager = new SoundManager();
