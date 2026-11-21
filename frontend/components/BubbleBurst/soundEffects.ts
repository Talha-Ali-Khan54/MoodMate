"use client";

class BubbleSoundManager {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  /**
   * Synthesize an organic, snappy bubble pop sound
   */
  playPop(isSpecial = false) {
    if (this.muted) return;

    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const baseFreq = isSpecial ? 650 + Math.random() * 250 : 380 + Math.random() * 220;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isSpecial ? "triangle" : "sine";
      const now = ctx.currentTime;

      // Quick pitch swoop characteristic of bursting water/air bubbles
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, now + 0.03);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.45, now + 0.08);

      // Fast percussive envelope
      gain.gain.setValueAtTime(isSpecial ? 0.35 : 0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isSpecial ? 0.12 : 0.08));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Audio playback fails safely if blocked by browser policy
    }
  }

  /**
   * Play celebration jingle when the game finishes
   */
  playCelebration() {
    if (this.muted) return;

    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + idx * 0.09;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    } catch {
      // Safe fallback
    }
  }
}

export const soundManager = new BubbleSoundManager();
