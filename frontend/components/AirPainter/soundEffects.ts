"use client";

class AirPainterSoundManager {
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

  // Countdown Beeps for "3", "2", "1" and celebratory "START!"
  playCountdownBeep(isStart: boolean = false) {
    if (this.muted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isStart ? "triangle" : "sine";
      const freq = isStart ? 880 : 523.25; // 880Hz (A5) for START!, 523Hz (C5) for 3, 2, 1
      osc.frequency.setValueAtTime(freq, now);

      if (isStart) {
        osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.15); // Upward chirp to C6
      }

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (isStart ? 0.45 : 0.22));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + (isStart ? 0.46 : 0.23));
    } catch {}
  }

  // Soft resonant shimmer when drawing trails
  playBrushSparkle(pitchShift: number = 0) {
    if (this.muted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const baseFreq = 587.33; // D5
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq + (pitchShift % 6) * 75, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {}
  }

  // Chime when switching color palettes
  playColorSwitch() {
    if (this.muted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(783.99, now); // G5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.08); // C6

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {}
  }

  // Whimsical celebration chord when finished
  playFinishCelebration() {
    if (this.muted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const chord = [392.0, 493.88, 587.33, 783.99, 987.77];
      const now = ctx.currentTime;

      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.07);

        gain.gain.setValueAtTime(0.001, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.09, now + i * 0.07 + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.07);
        osc.stop(now + 2.1);
      });
    } catch {}
  }
}

export const soundManager = new AirPainterSoundManager();