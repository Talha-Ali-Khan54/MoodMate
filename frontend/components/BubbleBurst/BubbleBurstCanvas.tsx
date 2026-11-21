"use client";

import { useEffect, useRef, useCallback } from "react";
import type { FingertipData } from "@/hooks/useHandLandmarker";
import type {
  Bubble,
  Particle,
  PopEffect,
  CursorPoint,
  CursorTrailPoint,
} from "./types";
import { soundManager } from "./soundEffects";

interface BubbleBurstCanvasProps {
  fingertips: FingertipData[];
  videoDimensions: { width: number; height: number };
  isPlaying: boolean;
  isPaused: boolean;
  onBubblePopped: (points: number, isSpecial?: boolean) => void;
}

const BUBBLE_COLORS = [
  { main: "#FF765E", glow: "rgba(255, 118, 94, 0.4)" }, // Coral / Spark
  { main: "#75C9F5", glow: "rgba(117, 201, 245, 0.4)" }, // Blue
  { main: "#FFD83D", glow: "rgba(255, 216, 61, 0.4)" }, // Yellow
  { main: "#B991E8", glow: "rgba(185, 145, 232, 0.4)" }, // Lavender
  { main: "#A8E6C3", glow: "rgba(168, 230, 195, 0.4)" }, // Mint
  { main: "#FFB0E0", glow: "rgba(255, 176, 224, 0.4)" }, // Pink
];

export function mapLandmarkToCanvas(
  normX: number,
  normY: number,
  videoWidth: number,
  videoHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  mirrored = true
): { x: number; y: number } {
  const x = mirrored ? 1 - normX : normX;
  const y = normY;

  if (!videoWidth || !videoHeight || !canvasWidth || !canvasHeight) {
    return { x: x * canvasWidth, y: y * canvasHeight };
  }

  const videoAspect = videoWidth / videoHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  let renderWidth = canvasWidth;
  let renderHeight = canvasHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (canvasAspect > videoAspect) {
    renderHeight = canvasWidth / videoAspect;
    offsetY = (canvasHeight - renderHeight) / 2;
  } else {
    renderWidth = canvasHeight * videoAspect;
    offsetX = (canvasWidth - renderWidth) / 2;
  }

  return {
    x: offsetX + x * renderWidth,
    y: offsetY + y * renderHeight,
  };
}

export function BubbleBurstCanvas({
  fingertips,
  videoDimensions,
  isPlaying,
  isPaused,
  onBubblePopped,
}: BubbleBurstCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keep latest props in refs to avoid restarting the render loop
  const fingertipsRef = useRef(fingertips);
  const videoDimsRef = useRef(videoDimensions);
  const isPlayingRef = useRef(isPlaying);
  const isPausedRef = useRef(isPaused);
  const onPoppedRef = useRef(onBubblePopped);

  fingertipsRef.current = fingertips;
  videoDimsRef.current = videoDimensions;
  isPlayingRef.current = isPlaying;
  isPausedRef.current = isPaused;
  onPoppedRef.current = onBubblePopped;

  // Game internal state stored in refs for 60fps performance
  const bubblesRef = useRef<Bubble[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const popEffectsRef = useRef<PopEffect[]>([]);
  const trailRef = useRef<CursorTrailPoint[]>([]);
  const nextIdRef = useRef(1);

  // Helper to spawn a bubble
  const spawnBubble = useCallback(
    (canvasWidth: number, canvasHeight: number, startAtBottom = false): Bubble => {
      const id = ++nextIdRef.current;
      const roll = Math.random();
      const isSpecial = roll < 0.12; // 12% chance for Golden Spark bubble

      let baseRadius: number;
      let points: number;
      let colorDef: { main: string; glow: string };

      if (isSpecial) {
        baseRadius = 28 + Math.random() * 8;
        points = 50;
        colorDef = { main: "#FFE156", glow: "rgba(255, 225, 86, 0.6)" };
      } else if (roll < 0.45) {
        // Small bubble (agile, fast)
        baseRadius = 22 + Math.random() * 6;
        points = 30;
        colorDef = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
      } else if (roll < 0.8) {
        // Medium bubble
        baseRadius = 32 + Math.random() * 7;
        points = 20;
        colorDef = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
      } else {
        // Large bubble
        baseRadius = 44 + Math.random() * 8;
        points = 10;
        colorDef = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
      }

      // Safe horizontal bounds
      const margin = baseRadius + 40;
      const x = margin + Math.random() * Math.max(100, canvasWidth - margin * 2);

      // Vertical position
      const y = startAtBottom
        ? canvasHeight + baseRadius + Math.random() * 80
        : margin + Math.random() * (canvasHeight - margin * 2);

      // Floating speeds
      const speedY = -(0.7 + Math.random() * 1.2 + (isSpecial ? 0.3 : 0));
      const speedX = (Math.random() - 0.5) * 0.8;

      return {
        id,
        x,
        y,
        baseRadius,
        radius: baseRadius,
        color: colorDef.main,
        glowColor: colorDef.glow,
        points,
        speedX,
        speedY,
        wobbleSpeed: 0.03 + Math.random() * 0.04,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 2 + Math.random() * 3,
        createdAt: performance.now(),
        isSpecial,
      };
    },
    []
  );

  // Initialize bubbles when game starts
  useEffect(() => {
    if (isPlaying) {
      const canvas = canvasRef.current;
      const w = canvas?.width || 800;
      const h = canvas?.height || 600;

      const initial: Bubble[] = [];
      const targetCount = 10;
      for (let i = 0; i < targetCount; i++) {
        initial.push(spawnBubble(w, h, false));
      }
      bubblesRef.current = initial;
      particlesRef.current = [];
      popEffectsRef.current = [];
      trailRef.current = [];
    } else {
      bubblesRef.current = [];
      particlesRef.current = [];
      popEffectsRef.current = [];
      trailRef.current = [];
    }
  }, [isPlaying, spawnBubble]);

  // Main 60fps render & physics loop
  useEffect(() => {
    let animId = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays smoothly
    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.floor(rect.width * dpr);
      const targetHeight = Math.floor(rect.height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    let lastTime = performance.now();

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);

      if (!isPlayingRef.current) return;

      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Clear previous frame
      ctx.clearRect(0, 0, width, height);

      const isPaused = isPausedRef.current;

      // 1. Map index fingertips to canvas coordinates
      const currentTips = fingertipsRef.current;
      const videoDims = videoDimsRef.current;
      const mappedCursors: CursorPoint[] = [];

      for (const tip of currentTips) {
        const pt = mapLandmarkToCanvas(
          tip.x,
          tip.y,
          videoDims.width,
          videoDims.height,
          width,
          height,
          true // horizontally mirrored to match selfie preview
        );
        mappedCursors.push({
          x: pt.x,
          y: pt.y,
          handIndex: tip.handIndex,
        });

        // Add trail points
        if (!isPaused) {
          trailRef.current.push({
            x: pt.x,
            y: pt.y,
            alpha: 1.0,
            handIndex: tip.handIndex,
          });
        }
      }

      // Keep trail length manageable
      if (trailRef.current.length > 30) {
        trailRef.current.splice(0, trailRef.current.length - 30);
      }

      // 2. Update and check bubble collisions (if not paused)
      const currentBubbles = bubblesRef.current;
      const remainingBubbles: Bubble[] = [];
      const cursorRadius = 26 * dpr; // Responsive fingertip collision radius

      for (let i = 0; i < currentBubbles.length; i++) {
        const b = currentBubbles[i];
        let popped = false;

        if (!isPaused) {
          // Update physics
          b.y += b.speedY * 60 * dt * dpr;
          b.wobblePhase += b.wobbleSpeed;
          b.x += (b.speedX + Math.sin(b.wobblePhase) * 0.7) * 60 * dt * dpr;

          // Subtle breathing radius
          b.radius = b.baseRadius * dpr + Math.sin(b.wobblePhase * 1.5) * (b.wobbleAmp * dpr);

          // Wall bounce
          if (b.x < b.radius + 10 * dpr) {
            b.x = b.radius + 10 * dpr;
            b.speedX = Math.abs(b.speedX);
          } else if (b.x > width - b.radius - 10 * dpr) {
            b.x = width - b.radius - 10 * dpr;
            b.speedX = -Math.abs(b.speedX);
          }

          // Check collision against all detected index fingertips
          for (const cur of mappedCursors) {
            const dx = cur.x - b.x;
            const dy = cur.y - b.y;
            const dist = Math.hypot(dx, dy);

            if (dist <= b.radius + cursorRadius) {
              popped = true;

              // Play synthesized pop
              soundManager.playPop(b.isSpecial);

              // Notify parent score handler
              onPoppedRef.current(b.points, b.isSpecial);

              // Create burst particles
              const particleCount = b.isSpecial ? 22 : 14;
              for (let p = 0; p < particleCount; p++) {
                const angle = (Math.PI * 2 * p) / particleCount + (Math.random() - 0.5) * 0.4;
                const speed = (2.5 + Math.random() * 4.5) * dpr;
                particlesRef.current.push({
                  id: ++nextIdRef.current,
                  x: b.x,
                  y: b.y,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed,
                  radius: (2.5 + Math.random() * 3.5) * dpr,
                  color: b.color,
                  alpha: 1.0,
                  life: 0,
                  maxLife: 24 + Math.random() * 10,
                });
              }

              // Create expanding shockwave ring and floating points
              popEffectsRef.current.push({
                id: ++nextIdRef.current,
                x: b.x,
                y: b.y,
                radius: b.radius,
                maxRadius: b.radius * 2.2,
                color: b.color,
                points: b.points,
                text: b.isSpecial ? `+${b.points} SPARK!` : `+${b.points}`,
                alpha: 1.0,
                createdAt: now,
              });

              break; // Don't check other cursors for this already-popped bubble
            }
          }

          // If bubble reached the top edge without being popped, recycle it to the bottom
          if (!popped && b.y < -b.radius - 20 * dpr) {
            remainingBubbles.push(spawnBubble(width, height, true));
            continue;
          }
        }

        if (!popped) {
          remainingBubbles.push(b);
        }
      }

      // Maintain ideal bubble density (~10 bubbles)
      while (remainingBubbles.length < 10) {
        remainingBubbles.push(spawnBubble(width, height, true));
      }
      bubblesRef.current = remainingBubbles;

      // 3. Draw bubbles
      for (const b of remainingBubbles) {
        ctx.save();

        // Outer glow
        ctx.shadowColor = b.glowColor;
        ctx.shadowBlur = (b.isSpecial ? 20 : 12) * dpr;

        // Translucent bubble body with 3D gradient
        const grad = ctx.createRadialGradient(
          b.x - b.radius * 0.32,
          b.y - b.radius * 0.35,
          b.radius * 0.1,
          b.x,
          b.y,
          b.radius
        );
        grad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
        grad.addColorStop(0.3, b.isSpecial ? "rgba(255, 240, 160, 0.65)" : b.glowColor);
        grad.addColorStop(0.8, b.isSpecial ? "rgba(255, 215, 0, 0.45)" : b.glowColor);
        grad.addColorStop(1, b.color);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();

        // Rim stroke
        ctx.lineWidth = (b.isSpecial ? 3 : 2) * dpr;
        ctx.strokeStyle = b.isSpecial ? "#FFF8D6" : "rgba(255, 255, 255, 0.75)";
        ctx.stroke();

        // Specular highlight crescent (top-left)
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
        ctx.beginPath();
        ctx.ellipse(
          b.x - b.radius * 0.38,
          b.y - b.radius * 0.38,
          b.radius * 0.28,
          b.radius * 0.16,
          -Math.PI / 4,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // Secondary subtle reflection (bottom-right)
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.beginPath();
        ctx.ellipse(
          b.x + b.radius * 0.32,
          b.y + b.radius * 0.32,
          b.radius * 0.18,
          b.radius * 0.08,
          -Math.PI / 4,
          0,
          Math.PI * 2
        );
        ctx.fill();

        // Points badge inside bubble for visual clarity
        ctx.fillStyle = "#20213F";
        ctx.font = `bold ${Math.max(11 * dpr, Math.floor(b.radius * 0.48))}px Fredoka, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${b.points}`, b.x, b.y + 1 * dpr);

        ctx.restore();
      }

      // 4. Update and draw particles
      const currentParticles = particlesRef.current;
      const remainingParticles: Particle[] = [];

      for (const p of currentParticles) {
        if (!isPaused) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.08 * dpr; // Gravity
          p.vx *= 0.98; // Friction
          p.life++;
          p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        }

        if (p.alpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6 * dpr;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          remainingParticles.push(p);
        }
      }
      particlesRef.current = remainingParticles;

      // 5. Update and draw pop shockwaves and floating point text
      const currentPopEffects = popEffectsRef.current;
      const remainingPopEffects: PopEffect[] = [];

      for (const eff of currentPopEffects) {
        if (!isPaused) {
          eff.radius += (eff.maxRadius - eff.radius) * 0.15;
          eff.alpha -= 0.035;
          eff.y -= 1.2 * dpr; // Float upward
        }

        if (eff.alpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, eff.alpha);

          // Shockwave ring
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
          ctx.lineWidth = 3.5 * dpr;
          ctx.strokeStyle = eff.color;
          ctx.shadowColor = eff.color;
          ctx.shadowBlur = 10 * dpr;
          ctx.stroke();

          // Floating score text
          if (eff.text) {
            ctx.font = `700 ${18 * dpr}px Fredoka, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // Dark outline for high readability against camera background
            ctx.strokeStyle = "#20213F";
            ctx.lineWidth = 4 * dpr;
            ctx.strokeText(eff.text, eff.x, eff.y);

            ctx.fillStyle = "#FFD83D";
            ctx.fillText(eff.text, eff.x, eff.y);
          }

          ctx.restore();
          remainingPopEffects.push(eff);
        }
      }
      popEffectsRef.current = remainingPopEffects;

      // 6. Draw cursor trail
      const currentTrail = trailRef.current;
      for (let i = currentTrail.length - 1; i >= 0; i--) {
        const tp = currentTrail[i];
        if (!isPaused) {
          tp.alpha -= 0.05;
        }
        if (tp.alpha > 0.05) {
          ctx.save();
          ctx.globalAlpha = tp.alpha * 0.45;
          ctx.fillStyle = tp.handIndex === 0 ? "#FF765E" : "#75C9F5";
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 8 * dpr * tp.alpha, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          currentTrail.splice(i, 1);
        }
      }

      // 7. Draw glowing fingertip cursors
      for (const cur of mappedCursors) {
        ctx.save();

        const handColor = cur.handIndex === 0 ? "#FF765E" : "#75C9F5";
        const glowColor = cur.handIndex === 0 ? "rgba(255, 118, 94, 0.6)" : "rgba(117, 201, 245, 0.6)";

        // Outer pulsing ring
        const pulse = Math.sin(now * 0.01) * 4 * dpr;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 16 * dpr;

        const haloGrad = ctx.createRadialGradient(
          cur.x,
          cur.y,
          4 * dpr,
          cur.x,
          cur.y,
          (26 + pulse) * dpr
        );
        haloGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        haloGrad.addColorStop(0.35, glowColor);
        haloGrad.addColorStop(1, "rgba(255, 118, 94, 0)");

        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, (26 + pulse) * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Inner sharp targeting ring
        ctx.shadowBlur = 8 * dpr;
        ctx.lineWidth = 2.5 * dpr;
        ctx.strokeStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 14 * dpr, 0, Math.PI * 2);
        ctx.stroke();

        // Center fingertip pin
        ctx.fillStyle = handColor;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 6 * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Hand indicator label
        ctx.font = `bold ${10 * dpr}px Nunito, sans-serif`;
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.shadowColor = "#20213F";
        ctx.shadowBlur = 4 * dpr;
        ctx.fillText(`Hand ${cur.handIndex + 1}`, cur.x, cur.y - 24 * dpr);

        ctx.restore();
      }
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, [spawnBubble]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
    />
  );
}
