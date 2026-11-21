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
  { main: "#FF765E", glow: "rgba(255, 118, 94, 0.45)" }, // Coral / Spark
  { main: "#75C9F5", glow: "rgba(117, 201, 245, 0.45)" }, // Blue
  { main: "#FFD83D", glow: "rgba(255, 216, 61, 0.45)" }, // Yellow
  { main: "#B991E8", glow: "rgba(185, 145, 232, 0.45)" }, // Lavender
  { main: "#A8E6C3", glow: "rgba(168, 230, 195, 0.45)" }, // Mint
  { main: "#FFB0E0", glow: "rgba(255, 176, 224, 0.45)" }, // Pink
];

// Distance from point (px, py) to line segment (x1, y1)-(x2, y2)
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

  // Previous cursor positions for continuous swipe collision detection
  const prevCursorsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Mouse / Touch pointer fallback
  const mousePointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -999,
    y: -999,
    active: false,
  });

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
      const isSpecial = roll < 0.14; // 14% chance for Golden Spark bubble

      let baseRadius: number;
      let points: number;
      let colorDef: { main: string; glow: string };

      if (isSpecial) {
        baseRadius = 32 + Math.random() * 8;
        points = 50;
        colorDef = { main: "#FFE156", glow: "rgba(255, 225, 86, 0.6)" };
      } else if (roll < 0.45) {
        // Small bubble (agile, fast)
        baseRadius = 24 + Math.random() * 6;
        points = 30;
        colorDef = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
      } else if (roll < 0.8) {
        // Medium bubble
        baseRadius = 35 + Math.random() * 7;
        points = 20;
        colorDef = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
      } else {
        // Large bubble
        baseRadius = 46 + Math.random() * 10;
        points = 10;
        colorDef = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
      }

      // Safe horizontal bounds
      const margin = baseRadius + 30;
      const x = margin + Math.random() * Math.max(80, canvasWidth - margin * 2);

      // Vertical position
      const y = startAtBottom
        ? canvasHeight + baseRadius + Math.random() * 60
        : margin + Math.random() * Math.max(100, canvasHeight - margin * 2);

      // Floating speeds
      const speedY = -(0.8 + Math.random() * 1.3 + (isSpecial ? 0.3 : 0));
      const speedX = (Math.random() - 0.5) * 0.9;

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
      const targetCount = 11;
      for (let i = 0; i < targetCount; i++) {
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
      const targetWidth = Math.max(300, Math.floor(rect.width * dpr));
      const targetHeight = Math.max(200, Math.floor(rect.height * dpr));

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    // Mouse / Touch handlers for additional interaction
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

      // Clear previous frame
      ctx.clearRect(0, 0, width, height);

      const isPaused = isPausedRef.current;

      // 1. Map hand points to canvas coordinates
      const currentTips = fingertipsRef.current;
      const videoDims = videoDimsRef.current;
      const mappedCursors: Array<CursorPoint & { idKey: string; isTip: boolean }> = [];

      for (let i = 0; i < currentTips.length; i++) {
        const tip = currentTips[i];
        const pt = mapLandmarkToCanvas(
          tip.x,
          tip.y,
          videoDims.width,
          videoDims.height,
          width,
          height,
          true // horizontally mirrored to match selfie preview
        );

        const lmKey = `${tip.handIndex}-${tip.landmarkIndex ?? i}`;
        mappedCursors.push({
          x: pt.x,
          y: pt.y,
          handIndex: tip.handIndex,
          idKey: lmKey,
          isTip: tip.isTip ?? (tip.landmarkIndex === 8 || tip.landmarkIndex === 12),
        });

        // Add trail points for fingertips
        if (!isPaused && (tip.isTip ?? tip.landmarkIndex === 8)) {
          trailRef.current.push({
            x: pt.x,
            y: pt.y,
            alpha: 1.0,
            handIndex: tip.handIndex,
          });
        }
      }

      // Add mouse cursor if active
      if (mousePointerRef.current.active) {
        mappedCursors.push({
          x: mousePointerRef.current.x,
          y: mousePointerRef.current.y,
          handIndex: 99,
          idKey: "mouse",
          isTip: true,
        });
      }

      // Keep trail length manageable
      if (trailRef.current.length > 36) {
        trailRef.current.splice(0, trailRef.current.length - 36);
      }

      // 2. Update and check bubble collisions with Continuous Swipe Detection
      const currentBubbles = bubblesRef.current;
      const remainingBubbles: Bubble[] = [];
      const prevMap = prevCursorsRef.current;

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

          // Check collision against all detected hand points and fast movement paths
          for (const cur of mappedCursors) {
            const hitRadius = (cur.isTip ? 42 : 50) * dpr; // Generous, satisfying hit area
            const prev = prevMap.get(cur.idKey);

            let hit = false;
            if (prev) {
              // Sweep line segment collision check
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

              // Play synthesized pop
              soundManager.playPop(b.isSpecial);

              // Notify parent score handler
              onPoppedRef.current(b.points, b.isSpecial);

              // Create burst particles
              const particleCount = b.isSpecial ? 24 : 16;
              for (let p = 0; p < particleCount; p++) {
                const angle = (Math.PI * 2 * p) / particleCount + (Math.random() - 0.5) * 0.4;
                const speed = (2.5 + Math.random() * 5.0) * dpr;
                particlesRef.current.push({
                  id: ++nextIdRef.current,
                  x: b.x,
                  y: b.y,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed,
                  radius: (3 + Math.random() * 3.5) * dpr,
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
                maxRadius: b.radius * 2.3,
                color: b.color,
                points: b.points,
                text: b.isSpecial ? `+${b.points} SPARK!` : `+${b.points}`,
                alpha: 1.0,
                createdAt: now,
              });

              break; // Bubble popped!
            }
          }

          // If bubble reached top without popping, recycle it to bottom
          if (!popped && b.y < -b.radius - 20 * dpr) {
            remainingBubbles.push(spawnBubble(width, height, true));
          } else if (!popped) {
            remainingBubbles.push(b);
          }
        } else {
          remainingBubbles.push(b);
        }
      }

      // Update previous cursor map for next frame's continuous swipe checks
      prevMap.clear();
      for (const cur of mappedCursors) {
        prevMap.set(cur.idKey, { x: cur.x, y: cur.y });
      }

      // Maintain active bubble count (keep 10-12 active bubbles floating)
      while (remainingBubbles.length < 11) {
        remainingBubbles.push(spawnBubble(width, height, true));
      }
      bubblesRef.current = remainingBubbles;

      // 3. Render Bubbles
      for (let i = 0; i < remainingBubbles.length; i++) {
        const b = remainingBubbles[i];
        ctx.save();

        // Outer glow
        ctx.shadowColor = b.glowColor;
        ctx.shadowBlur = (b.isSpecial ? 22 : 14) * dpr;

        // Bubble main sphere gradient
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

        // Bubble outer border
        ctx.strokeStyle = b.isSpecial ? "#FFF8CC" : "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = (b.isSpecial ? 3.5 : 2.5) * dpr;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Specular highlight crescent
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

        // Special golden spark indicator
        if (b.isSpecial) {
          ctx.fillStyle = "#20213F";
          ctx.font = `bold ${14 * dpr}px Fredoka, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("✦", b.x, b.y);
        }

        ctx.restore();
      }

      // 4. Update and Render Burst Particles
      const nextParticles: Particle[] = [];
      for (const p of particlesRef.current) {
        if (!isPaused) {
          p.x += p.vx * 60 * dt;
          p.y += p.vy * 60 * dt;
          p.vy += 0.12 * dpr; // slight gravity
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

      // 5. Update and Render Pop Effects (Shockwaves + Text)
      const nextPopEffects: PopEffect[] = [];
      for (const eff of popEffectsRef.current) {
        const age = (now - eff.createdAt) / 1000;
        const progress = Math.min(1, age / 0.55);

        if (progress < 1) {
          ctx.save();
          const currentRadius = eff.radius + (eff.maxRadius - eff.radius) * progress;
          const alpha = 1 - progress;

          // Expanding shockwave ring
          ctx.strokeStyle = eff.color;
          ctx.globalAlpha = alpha * 0.8;
          ctx.lineWidth = 3.5 * dpr * (1 - progress);
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, currentRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Floating score text
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

      // 6. Render Fingertip Movement Trails
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

      // 7. Render Vivid Hand Cursors
      for (const cur of mappedCursors) {
        if (!cur.isTip) continue; // Only draw prominent targeting halos on fingertips

        ctx.save();
        const pulse = Math.sin(now * 0.015) * 3;
        const handColor = cur.handIndex === 0 ? "#FF765E" : cur.handIndex === 1 ? "#75C9F5" : "#FFD83D";
        const glowColor = cur.handIndex === 0 ? "rgba(255, 118, 94, 0.85)" : "rgba(117, 201, 245, 0.85)";

        // Outer glowing aura
        const haloGrad = ctx.createRadialGradient(
          cur.x,
          cur.y,
          3 * dpr,
          cur.x,
          cur.y,
          (28 + pulse) * dpr
        );
        haloGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        haloGrad.addColorStop(0.35, glowColor);
        haloGrad.addColorStop(1, "rgba(255, 118, 94, 0)");

        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, (28 + pulse) * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Inner sharp targeting ring
        ctx.shadowBlur = 10 * dpr;
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 16 * dpr, 0, Math.PI * 2);
        ctx.stroke();

        // Center fingertip pin
        ctx.fillStyle = handColor;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 7 * dpr, 0, Math.PI * 2);
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
