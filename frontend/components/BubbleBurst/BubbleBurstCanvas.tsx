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

// Exactly 5 balloons floating on screen at any time (less crowded, more intentional)
const TARGET_BUBBLE_COUNT = 5;

const BUBBLE_COLORS = [
  { main: "#FF765E", glow: "rgba(255, 118, 94, 0.45)" }, // Coral / Spark
  { main: "#75C9F5", glow: "rgba(117, 201, 245, 0.45)" }, // Blue
  { main: "#FFD83D", glow: "rgba(255, 216, 61, 0.45)" }, // Yellow
  { main: "#B991E8", glow: "rgba(185, 145, 232, 0.45)" }, // Lavender
  { main: "#A8E6C3", glow: "rgba(168, 230, 195, 0.45)" }, // Mint
  { main: "#FFB0E0", glow: "rgba(255, 176, 224, 0.45)" }, // Pink
];

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

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

  const prevCursorsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Mouse fallback
  const mousePointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -999,
    y: -999,
    active: false,
  });

  const bubblesRef = useRef<Bubble[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const popEffectsRef = useRef<PopEffect[]>([]);
  const trailRef = useRef<CursorTrailPoint[]>([]);
  const nextIdRef = useRef(1);

  // Spawn balloon helper
  const spawnBubble = useCallback(
    (canvasWidth: number, canvasHeight: number, startAtBottom = false): Bubble => {
      const id = ++nextIdRef.current;
      const roll = Math.random();
      const isSpecial = roll < 0.15; // 15% special spark

      let baseRadius: number;
      let points: number;
      let colorDef: { main: string; glow: string };

      if (isSpecial) {
        baseRadius = 34 + Math.random() * 8;
        points = 50;
        colorDef = { main: "#FFE156", glow: "rgba(255, 225, 86, 0.6)" };
      } else if (roll < 0.45) {
        baseRadius = 26 + Math.random() * 6;
        points = 30;
        colorDef = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
      } else if (roll < 0.8) {
        baseRadius = 36 + Math.random() * 7;
        points = 20;
        colorDef = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
      } else {
        baseRadius = 46 + Math.random() * 8;
        points = 10;
        colorDef = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
      }

      const margin = baseRadius + 40;
      const x = margin + Math.random() * Math.max(80, canvasWidth - margin * 2);

      const y = startAtBottom
        ? canvasHeight + baseRadius + Math.random() * 70
        : margin + Math.random() * Math.max(100, canvasHeight - margin * 2);

      const speedY = -(0.85 + Math.random() * 1.1 + (isSpecial ? 0.3 : 0));
      const speedX = (Math.random() - 0.5) * 0.75;

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
        wobbleSpeed: 0.03 + Math.random() * 0.03,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 2 + Math.random() * 2.5,
        createdAt: performance.now(),
        isSpecial,
      };
    },
    []
  );

  // Initialize exactly TARGET_BUBBLE_COUNT bubbles
  useEffect(() => {
    if (isPlaying) {
      const canvas = canvasRef.current;
      const w = canvas?.width || 800;
      const h = canvas?.height || 600;

      const initial: Bubble[] = [];
      for (let i = 0; i < TARGET_BUBBLE_COUNT; i++) {
        initial.push(spawnBubble(w, h, false));
      }
      bubblesRef.current = initial;
      particlesRef.current = [];
      popEffectsRef.current = [];
      trailRef.current = [];
      prevCursorsRef.current.clear();
    } else {
      bubblesRef.current = [];
      particlesRef.current = [];
      popEffectsRef.current = [];
      trailRef.current = [];
      prevCursorsRef.current.clear();
    }
  }, [isPlaying, spawnBubble]);

  // Main 60fps render loop
  useEffect(() => {
    let animId = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.max(300, Math.floor(rect.width * dpr));
      const targetHeight = Math.max(200, Math.floor(rect.height * dpr));

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      mousePointerRef.current = {
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr,
        active: true,
      };
    };

    const handlePointerLeave = () => {
      mousePointerRef.current.active = false;
    };

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);

    let lastTime = performance.now();

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);

      if (!isPlayingRef.current) return;

      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const dt = Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);
      const isPaused = isPausedRef.current;

      // -------------------------------------------------------------
      // 1. STRICT INDEX FINGER ONLY FILTER (1 PER HAND, MAX 2 TOTAL)
      // -------------------------------------------------------------
      const currentTips = fingertipsRef.current;
      const videoDims = videoDimsRef.current;

      // Map unique index finger per handIndex (hand 0 and hand 1)
      const indexTipsMap = new Map<number, FingertipData>();

      for (let i = 0; i < currentTips.length; i++) {
        const tip = currentTips[i];
        // Index fingertip is landmark index 8 in MediaPipe Hands
        const isIndexFinger =
          tip.landmarkIndex === 8 ||
          (tip as any).tipIndex === 8 ||
          tip.isTip;

        if (isIndexFinger) {
          if (!indexTipsMap.has(tip.handIndex)) {
            indexTipsMap.set(tip.handIndex, tip);
          } else if (tip.landmarkIndex === 8) {
            indexTipsMap.set(tip.handIndex, tip);
          }
        }
      }

      // Fallback if landmark index wasn't tagged: take at most 1 tip per hand
      if (indexTipsMap.size === 0 && currentTips.length > 0) {
        for (const tip of currentTips) {
          if (!indexTipsMap.has(tip.handIndex)) {
            indexTipsMap.set(tip.handIndex, tip);
          }
        }
      }

      const mappedCursors: Array<CursorPoint & { idKey: string }> = [];

      for (const [handIndex, tip] of indexTipsMap.entries()) {
        const pt = mapLandmarkToCanvas(
          tip.x,
          tip.y,
          videoDims.width,
          videoDims.height,
          width,
          height,
          true
        );

        const lmKey = `hand-${handIndex}-index`;
        mappedCursors.push({
          x: pt.x,
          y: pt.y,
          handIndex,
          idKey: lmKey,
        });

        if (!isPaused) {
          trailRef.current.push({
            x: pt.x,
            y: pt.y,
            alpha: 1.0,
            handIndex,
          });
        }
      }

      // Optional mouse pointer support
      if (mousePointerRef.current.active) {
        mappedCursors.push({
          x: mousePointerRef.current.x,
          y: mousePointerRef.current.y,
          handIndex: 99,
          idKey: "mouse",
        });
      }

      if (trailRef.current.length > 28) {
        trailRef.current.splice(0, trailRef.current.length - 28);
      }

      // -------------------------------------------------------------
      // 2. BALLOON PHYSICS & POP COLLISIONS (TARGET 5 ACTIVE BALLOONS)
      // -------------------------------------------------------------
      const currentBubbles = bubblesRef.current;
      const remainingBubbles: Bubble[] = [];
      const prevMap = prevCursorsRef.current;

      for (let i = 0; i < currentBubbles.length; i++) {
        const b = currentBubbles[i];
        let popped = false;

        if (!isPaused) {
          b.y += b.speedY * 60 * dt * dpr;
          b.wobblePhase += b.wobbleSpeed;
          b.x += (b.speedX + Math.sin(b.wobblePhase) * 0.7) * 60 * dt * dpr;
          b.radius = b.baseRadius * dpr + Math.sin(b.wobblePhase * 1.5) * (b.wobbleAmp * dpr);

          if (b.x < b.radius + 10 * dpr) {
            b.x = b.radius + 10 * dpr;
            b.speedX = Math.abs(b.speedX);
          } else if (b.x > width - b.radius - 10 * dpr) {
            b.x = width - b.radius - 10 * dpr;
            b.speedX = -Math.abs(b.speedX);
          }

          // Exact pointer hit radius (calibrated for index fingertip)
          const hitRadius = 32 * dpr;

          for (const cur of mappedCursors) {
            const prev = prevMap.get(cur.idKey);
            let hit = false;

            if (prev) {
              const segmentDist = distToSegment(b.x, b.y, prev.x, prev.y, cur.x, cur.y);
              if (segmentDist <= b.radius + hitRadius) {
                hit = true;
              }
            } else {
              const pointDist = Math.hypot(cur.x - b.x, cur.y - b.y);
              if (pointDist <= b.radius + hitRadius) {
                hit = true;
              }
            }

            if (hit) {
              popped = true;
              soundManager.playPop(b.isSpecial);
              onPoppedRef.current(b.points, b.isSpecial);

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
                  radius: (2.5 + Math.random() * 3) * dpr,
                  color: b.color,
                  alpha: 1.0,
                  life: 0,
                  maxLife: 22 + Math.random() * 10,
                });
              }

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

              break;
            }
          }

          if (!popped && b.y < -b.radius - 20 * dpr) {
            remainingBubbles.push(spawnBubble(width, height, true));
          } else if (!popped) {
            remainingBubbles.push(b);
          }
        } else {
          remainingBubbles.push(b);
        }
      }

      prevMap.clear();
      for (const cur of mappedCursors) {
        prevMap.set(cur.idKey, { x: cur.x, y: cur.y });
      }

      // Maintain only TARGET_BUBBLE_COUNT (5 balloons)
      while (remainingBubbles.length < TARGET_BUBBLE_COUNT) {
        remainingBubbles.push(spawnBubble(width, height, true));
      }
      bubblesRef.current = remainingBubbles;

      // -------------------------------------------------------------
      // 3. RENDER BALLOONS
      // -------------------------------------------------------------
      for (let i = 0; i < remainingBubbles.length; i++) {
        const b = remainingBubbles[i];
        ctx.save();

        ctx.shadowColor = b.glowColor;
        ctx.shadowBlur = (b.isSpecial ? 22 : 14) * dpr;

        const sphereGrad = ctx.createRadialGradient(
          b.x - b.radius * 0.35,
          b.y - b.radius * 0.35,
          b.radius * 0.1,
          b.x,
          b.y,
          b.radius
        );
        sphereGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        sphereGrad.addColorStop(0.3, b.glowColor);
        sphereGrad.addColorStop(0.85, "rgba(255, 255, 255, 0.2)");
        sphereGrad.addColorStop(1, b.color);

        ctx.fillStyle = sphereGrad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = b.isSpecial ? "#FFF8CC" : "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = (b.isSpecial ? 3.5 : 2.5) * dpr;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.ellipse(
          b.x - b.radius * 0.38,
          b.y - b.radius * 0.38,
          b.radius * 0.26,
          b.radius * 0.14,
          -Math.PI / 4,
          0,
          Math.PI * 2
        );
        ctx.fill();

        if (b.isSpecial) {
          ctx.fillStyle = "#20213F";
          ctx.font = `bold ${14 * dpr}px Fredoka, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("✦", b.x, b.y);
        }

        ctx.restore();
      }

      // -------------------------------------------------------------
      // 4. RENDER PARTICLES & SHOCKWAVES
      // -------------------------------------------------------------
      const nextParticles: Particle[] = [];
      for (const p of particlesRef.current) {
        if (!isPaused) {
          p.x += p.vx * 60 * dt;
          p.y += p.vy * 60 * dt;
          p.vy += 0.12 * dpr;
          p.life++;
          p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        }

        if (p.alpha > 0.05) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8 * dpr;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          nextParticles.push(p);
        }
      }
      particlesRef.current = nextParticles;

      const nextPopEffects: PopEffect[] = [];
      for (const eff of popEffectsRef.current) {
        const age = (now - eff.createdAt) / 1000;
        const progress = Math.min(1, age / 0.55);

        if (progress < 1) {
          ctx.save();
          const currentRadius = eff.radius + (eff.maxRadius - eff.radius) * progress;
          const alpha = 1 - progress;

          ctx.strokeStyle = eff.color;
          ctx.globalAlpha = alpha * 0.8;
          ctx.lineWidth = 3.5 * dpr * (1 - progress);
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, currentRadius, 0, Math.PI * 2);
          ctx.stroke();

          if (eff.text) {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = "#FFFFFF";
            ctx.shadowColor = "#20213F";
            ctx.shadowBlur = 6 * dpr;
            ctx.font = `bold ${Math.floor(18 * dpr)}px Fredoka, sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(eff.text, eff.x, eff.y - progress * 40 * dpr);
          }

          ctx.restore();
          nextPopEffects.push(eff);
        }
      }
      popEffectsRef.current = nextPopEffects;

      // -------------------------------------------------------------
      // 5. RENDER INDEX FINGER TRAILS & POINTER RETICLES
      // -------------------------------------------------------------
      for (let i = 0; i < trailRef.current.length; i++) {
        const pt = trailRef.current[i];
        if (!isPaused) {
          pt.alpha -= 0.04;
        }

        if (pt.alpha > 0.05) {
          ctx.save();
          const trailColor = pt.handIndex === 0 ? "#FF765E" : "#75C9F5";
          ctx.globalAlpha = pt.alpha * 0.45;
          ctx.fillStyle = trailColor;
          ctx.shadowColor = trailColor;
          ctx.shadowBlur = 10 * dpr;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8 * dpr * pt.alpha, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      trailRef.current = trailRef.current.filter((p) => p.alpha > 0.05);

      // Render crisp index finger crosshair reticles (1 per hand)
      for (const cur of mappedCursors) {
        ctx.save();
        const pulse = Math.sin(now * 0.015) * 3;
        const handColor = cur.handIndex === 0 ? "#FF765E" : cur.handIndex === 1 ? "#75C9F5" : "#FFD83D";
        const glowColor = cur.handIndex === 0 ? "rgba(255, 118, 94, 0.85)" : "rgba(117, 201, 245, 0.85)";

        // Outer halo
        const haloGrad = ctx.createRadialGradient(
          cur.x,
          cur.y,
          3 * dpr,
          cur.x,
          cur.y,
          (24 + pulse) * dpr
        );
        haloGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        haloGrad.addColorStop(0.35, glowColor);
        haloGrad.addColorStop(1, "rgba(255, 118, 94, 0)");

        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, (24 + pulse) * dpr, 0, Math.PI * 2);
        ctx.fill();

        // White ring
        ctx.shadowBlur = 10 * dpr;
        ctx.lineWidth = 2.8 * dpr;
        ctx.strokeStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 14 * dpr, 0, Math.PI * 2);
        ctx.stroke();

        // Pin center
        ctx.fillStyle = handColor;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 6 * dpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", updateCanvasSize);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [spawnBubble]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto cursor-crosshair z-10"
    />
  );
}