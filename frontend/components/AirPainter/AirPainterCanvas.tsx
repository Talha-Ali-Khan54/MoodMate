"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { FingertipData } from "@/hooks/useHandLandmarker";
import { soundManager } from "./soundEffects";
import {
  type Stroke,
  type Point,
  type SparkleParticle,
  type PaletteColor,
} from "./types";

interface AirPainterCanvasProps {
  fingertipsRef: MutableRefObject<FingertipData[]>;
  isPlaying: boolean;
  isPaused: boolean;
  isDrawingAllowed: boolean;
  currentColor: PaletteColor;
  brushSize: number;
  onStrokeCountChange?: (count: number) => void;
  exportRef?: MutableRefObject<(() => string | null) | null>;
}

export function AirPainterCanvas({
  fingertipsRef,
  isPlaying,
  isPaused,
  isDrawingAllowed,
  currentColor,
  brushSize,
  onStrokeCountChange,
  exportRef,
}: AirPainterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const particlesRef = useRef<SparkleParticle[]>([]);
  const isDrawingRef = useRef(false);
  const lastSparkleTime = useRef(0);
  const soundCounterRef = useRef(0);

  // Ultra-responsive immediate position ref
  const currentPosRef = useRef<{ x: number; y: number } | null>(null);
  const isMouseDownRef = useRef(false);

  // Expose export function
  useEffect(() => {
    if (exportRef) {
      exportRef.current = () => {
        if (!canvasRef.current) return null;
        return canvasRef.current.toDataURL("image/png");
      };
    }
  }, [exportRef]);

  // Main 60FPS High-Speed Render & Tracking Loop
  useEffect(() => {
    let animId = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Keep canvas dimensions synced
      if (
        canvas.width !== canvas.parentElement?.clientWidth ||
        canvas.height !== canvas.parentElement?.clientHeight
      ) {
        canvas.width = canvas.parentElement?.clientWidth || 640;
        canvas.height = canvas.parentElement?.clientHeight || 480;
      }

      // -------------------------------------------------------------
      // 1. FAST REAL-TIME FINGER PROCESSING (ZERO REACT LAG)
      // -------------------------------------------------------------
      if (isPlaying && !isPaused && isDrawingAllowed) {
        const tips = fingertipsRef.current;
        const indexTip = tips.find((t) => (t as any).tipIndex === 8) || tips[0];

        if (indexTip && indexTip.x !== undefined && indexTip.y !== undefined) {
          // Instant direct coordinate calculation
          const rawX = (1 - indexTip.x) * canvas.width;
          const rawY = indexTip.y * canvas.height;

          // 90% instant tracking: eliminates lag/sluggishness while preventing subpixel flicker
          if (!currentPosRef.current) {
            currentPosRef.current = { x: rawX, y: rawY };
          } else {
            currentPosRef.current.x = currentPosRef.current.x * 0.1 + rawX * 0.9;
            currentPosRef.current.y = currentPosRef.current.y * 0.1 + rawY * 0.9;
          }

          const targetX = currentPosRef.current.x;
          const targetY = currentPosRef.current.y;

          const newPoint: Point = {
            x: targetX,
            y: targetY,
            color: currentColor.hex,
            size: brushSize,
            timestamp: performance.now(),
          };

          if (!isDrawingRef.current) {
            isDrawingRef.current = true;
            const newStroke: Stroke = {
              id: Date.now(),
              points: [newPoint],
              color: currentColor.hex,
              size: brushSize,
            };
            currentStrokeRef.current = newStroke;
            strokesRef.current.push(newStroke);
            onStrokeCountChange?.(strokesRef.current.length);
          } else if (currentStrokeRef.current) {
            const pts = currentStrokeRef.current.points;
            const lastPt = pts[pts.length - 1];

            // Ultra-sensitive threshold (1.5px) captures fast finger flicks immediately
            const dist = Math.hypot(targetX - lastPt.x, targetY - lastPt.y);
            if (dist >= 1.5) {
              pts.push(newPoint);

              // Sparkle particle trail
              const now = performance.now();
              if (now - lastSparkleTime.current > 35) {
                lastSparkleTime.current = now;
                soundCounterRef.current += 1;
                if (soundCounterRef.current % 4 === 0) {
                  soundManager.playBrushSparkle(soundCounterRef.current);
                }

                particlesRef.current.push({
                  id: Math.random(),
                  x: targetX + (Math.random() - 0.5) * 8,
                  y: targetY + (Math.random() - 0.5) * 8,
                  vx: (Math.random() - 0.5) * 2.5,
                  vy: (Math.random() - 0.5) * 2.5,
                  size: Math.random() * 3.5 + 1.5,
                  color: currentColor.hex,
                  alpha: 1,
                  maxLife: 18,
                  life: 18,
                });
              }
            }
          }
        } else {
          isDrawingRef.current = false;
          currentStrokeRef.current = null;
          currentPosRef.current = null;
        }
      } else {
        isDrawingRef.current = false;
        currentStrokeRef.current = null;
        currentPosRef.current = null;
      }

      // -------------------------------------------------------------
      // 2. DRAWING STROKES & NEON GLOW
      // -------------------------------------------------------------
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const stroke of strokesRef.current) {
        if (stroke.points.length < 2) continue;

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Pass 1: Neon Aura Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = stroke.color;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size + 6;
        ctx.globalAlpha = 0.4;

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          const xc = (stroke.points[i - 1].x + stroke.points[i].x) / 2;
          const yc = (stroke.points[i - 1].y + stroke.points[i].y) / 2;
          ctx.quadraticCurveTo(stroke.points[i - 1].x, stroke.points[i - 1].y, xc, yc);
        }
        ctx.stroke();

        // Pass 2: Sharp Vibrant Stroke
        ctx.shadowBlur = 8;
        ctx.lineWidth = stroke.size;
        ctx.globalAlpha = 0.95;
        ctx.stroke();

        // Pass 3: White Core Center
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = Math.max(2, stroke.size * 0.35);
        ctx.globalAlpha = 0.9;
        ctx.stroke();

        ctx.restore();
      }

      // Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        p.alpha = p.life / p.maxLife;

        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Instant Tracking Reticle glued right onto your fingertip
      if (currentPosRef.current && isDrawingAllowed) {
        const cx = currentPosRef.current.x;
        const cy = currentPosRef.current.y;

        ctx.save();
        ctx.shadowBlur = 14;
        ctx.shadowColor = currentColor.hex;
        ctx.strokeStyle = currentColor.hex;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, brushSize / 2 + 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isPaused, isDrawingAllowed, currentColor, brushSize, onStrokeCountChange, fingertipsRef]);

  // Mouse / Touch Fallback Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingAllowed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isMouseDownRef.current = true;
    const newStroke: Stroke = {
      id: Date.now(),
      points: [{ x, y, color: currentColor.hex, size: brushSize, timestamp: performance.now() }],
      color: currentColor.hex,
      size: brushSize,
    };
    currentStrokeRef.current = newStroke;
    strokesRef.current.push(newStroke);
    onStrokeCountChange?.(strokesRef.current.length);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMouseDownRef.current || !currentStrokeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentStrokeRef.current.points.push({
      x,
      y,
      color: currentColor.hex,
      size: brushSize,
      timestamp: performance.now(),
    });
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
    currentStrokeRef.current = null;
  };

  return (
    <div className="absolute inset-0 z-10 w-full h-full pointer-events-auto">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="w-full h-full cursor-crosshair"
      />
    </div>
  );
}