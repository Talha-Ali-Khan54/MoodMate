"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Star, Particle, BackgroundCloud } from "./types";
import { soundManager } from "./soundEffects";

interface CloudCatcherCanvasProps {
  headXRef: React.MutableRefObject<number>;
  collectedStars: number;
  targetStars: number;
  isPlaying: boolean;
  isPaused: boolean;
  onStarCollected: () => void;
  currentMessage: string | null;
}

// Draw a 5-pointed star
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

// Color interpolation helper
function lerpColor(color1: string, color2: string, factor: number): string {
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);

  const r1 = (c1 >> 16) & 255;
  const g1 = (c1 >> 8) & 255;
  const b1 = c1 & 255;

  const r2 = (c2 >> 16) & 255;
  const g2 = (c2 >> 8) & 255;
  const b2 = c2 & 255;

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  return `rgb(${r}, ${g}, ${b})`;
}

export function CloudCatcherCanvas({
  headXRef,
  collectedStars,
  targetStars,
  isPlaying,
  isPaused,
  onStarCollected,
  currentMessage,
}: CloudCatcherCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keep references updated for 60fps loop
  const collectedRef = useRef(collectedStars);
  const isPlayingRef = useRef(isPlaying);
  const isPausedRef = useRef(isPaused);
  const onCollectRef = useRef(onStarCollected);
  const messageRef = useRef(currentMessage);

  collectedRef.current = collectedStars;
  isPlayingRef.current = isPlaying;
  isPausedRef.current = isPaused;
  onCollectRef.current = onStarCollected;
  messageRef.current = currentMessage;

  // Mouse / Pointer fallback
  const mouseXRef = useRef<number | null>(null);

  // Game internal state
  const starsRef = useRef<Star[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const bgCloudsRef = useRef<BackgroundCloud[]>([]);
  const cloudCharacterRef = useRef({
    x: 400,
    y: 500,
    catchBounce: 0,
    catchTimer: 0,
    idlePhase: 0,
  });
  const nextIdRef = useRef(1);

  // Helper to spawn a gentle floating star
  const spawnStar = useCallback((canvasWidth: number, startAtTop = true): Star => {
    const id = ++nextIdRef.current;
    const radius = 24 + Math.random() * 8;
    const margin = radius + 60;
    const x = margin + Math.random() * Math.max(100, canvasWidth - margin * 2);
    const y = startAtTop ? -radius - Math.random() * 80 : Math.random() * 300;

    return {
      id,
      x,
      y,
      radius,
      speedY: 0.9 + Math.random() * 0.9,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.02 + Math.random() * 0.03,
      wobbleAmp: 1.5 + Math.random() * 2.5,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.03,
      glowColor: "rgba(255, 225, 86, 0.65)",
    };
  }, []);

  // Initialize background clouds & stars
  useEffect(() => {
    if (isPlaying) {
      const canvas = canvasRef.current;
      const w = canvas?.width || 800;

      // 4 drifting background clouds
      bgCloudsRef.current = [
        { x: w * 0.1, y: 80, width: 180, height: 75, speed: 0.25, scale: 1.0, opacity: 0.8 },
        { x: w * 0.65, y: 140, width: 220, height: 90, speed: 0.35, scale: 1.2, opacity: 0.7 },
        { x: w * 0.35, y: 220, width: 160, height: 65, speed: 0.2, scale: 0.85, opacity: 0.65 },
        { x: w * 0.85, y: 60, width: 190, height: 80, speed: 0.3, scale: 1.1, opacity: 0.75 },
      ];

      // Spawn initial active stars
      const initialStars: Star[] = [];
      for (let i = 0; i < 3; i++) {
        initialStars.push(spawnStar(w, false));
      }
      starsRef.current = initialStars;
      particlesRef.current = [];
    }
  }, [isPlaying, spawnStar]);

  // Main 60fps render loop
  useEffect(() => {
    let animId = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI crisp rendering
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.max(300, Math.floor(rect.width * dpr));
      const targetH = Math.max(200, Math.floor(rect.height * dpr));

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    // Pointer events for mouse / touch fallback
    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      mouseXRef.current = (e.clientX - rect.left) * dpr;
    };
    const onPointerLeave = () => {
      mouseXRef.current = null;
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    let lastTime = performance.now();
    let sunRayRotation = 0;

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);

      if (!isPlayingRef.current) return;

      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const dt = Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;

      const isPaused = isPausedRef.current;
      const progress = Math.min(1, collectedRef.current / targetStars);

      // =========================================================================
      // 1. DYNAMIC SKY BACKGROUND TRANSFORMATION
      // =========================================================================
      // Stage 1 (Gloomy/Cloudy): Dark slate grey-blue
      // Stage 2 (Clearing): Soft periwinkle & silvery sky
      // Stage 3 (Sunny): Morning golden sunrise
      // Stage 4 (Clear Sky): Vibrant radiant sunny sky
      let topColor: string;
      let bottomColor: string;

      if (progress < 0.35) {
        // Stage 1 -> Stage 2
        const f = progress / 0.35;
        topColor = lerpColor("#2C3644", "#4F6D8A", f);
        bottomColor = lerpColor("#435164", "#7E9DBA", f);
      } else if (progress < 0.75) {
        // Stage 2 -> Stage 3
        const f = (progress - 0.35) / 0.4;
        topColor = lerpColor("#4F6D8A", "#4B92C9", f);
        bottomColor = lerpColor("#7E9DBA", "#F6CE9A", f);
      } else {
        // Stage 3 -> Stage 4
        const f = (progress - 0.75) / 0.25;
        topColor = lerpColor("#4B92C9", "#3A9BE5", f);
        bottomColor = lerpColor("#F6CE9A", "#FFF3D1", f);
      }

      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, topColor);
      skyGrad.addColorStop(1, bottomColor);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // =========================================================================
      // 2. SUN & RADIANT RAYS (Emerges gradually with star progress)
      // =========================================================================
      if (progress > 0.3) {
        const sunProgress = (progress - 0.3) / 0.7; // 0 to 1
        const sunX = width * 0.5;
        const sunY = height * (0.35 - sunProgress * 0.12);
        const sunRadius = (45 + sunProgress * 30) * dpr;

        ctx.save();
        ctx.globalAlpha = Math.min(1, sunProgress * 1.2);

        // Radiant Sunbeams
        if (!isPaused) {
          sunRayRotation += 0.003;
        }
        ctx.save();
        ctx.translate(sunX, sunY);
        ctx.rotate(sunRayRotation);
        const rayCount = 12;
        for (let i = 0; i < rayCount; i++) {
          ctx.rotate((Math.PI * 2) / rayCount);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-12 * dpr, sunRadius * 2.8);
          ctx.lineTo(12 * dpr, sunRadius * 2.8);
          ctx.closePath();
          ctx.fillStyle = "rgba(255, 235, 150, 0.07)";
          ctx.fill();
        }
        ctx.restore();

        // Outer Golden Halo
        const sunGlow = ctx.createRadialGradient(sunX, sunY, sunRadius * 0.2, sunX, sunY, sunRadius * 2.2);
        sunGlow.addColorStop(0, "rgba(255, 240, 160, 0.65)");
        sunGlow.addColorStop(0.5, "rgba(255, 215, 80, 0.25)");
        sunGlow.addColorStop(1, "rgba(255, 200, 60, 0)");
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Warm Sun Core
        const sunDisc = ctx.createRadialGradient(sunX - sunRadius * 0.2, sunY - sunRadius * 0.2, 0, sunX, sunY, sunRadius);
        sunDisc.addColorStop(0, "#FFFFFF");
        sunDisc.addColorStop(0.4, "#FFF385");
        sunDisc.addColorStop(1, "#FFB834");
        ctx.fillStyle = sunDisc;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // =========================================================================
      // 3. ROLLING BACKGROUND CLOUDS (Fade & brighten as sky clears)
      // =========================================================================
      const cloudShade = lerpColor("#4B5563", "#FFFFFF", progress);
      const cloudAlpha = Math.max(0.2, (1 - progress * 0.7) * 0.85);

      for (const bc of bgCloudsRef.current) {
        if (!isPaused) {
          bc.x += bc.speed * 60 * dt * dpr;
          if (bc.x - bc.width * dpr > width) {
            bc.x = -bc.width * dpr;
          }
        }

        ctx.save();
        ctx.globalAlpha = cloudAlpha;
        ctx.fillStyle = cloudShade;
        const cx = bc.x;
        const cy = bc.y * dpr;
        const cw = bc.width * dpr;
        const ch = bc.height * dpr;

        // Soft cloud puff geometry
        ctx.beginPath();
        ctx.arc(cx, cy, ch * 0.5, 0, Math.PI * 2);
        ctx.arc(cx + cw * 0.3, cy - ch * 0.25, ch * 0.65, 0, Math.PI * 2);
        ctx.arc(cx + cw * 0.65, cy - ch * 0.1, ch * 0.55, 0, Math.PI * 2);
        ctx.arc(cx + cw * 0.85, cy, ch * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // =========================================================================
      // 4. FLOATING COMFORTING STARS
      // =========================================================================
      const currentStars = starsRef.current;
      const remainingStars: Star[] = [];
      const char = cloudCharacterRef.current;

      // Character position (Smoothed Head Movement or Mouse fallback)
      let targetCharX: number;
      if (mouseXRef.current !== null) {
        targetCharX = mouseXRef.current;
      } else {
        const normX = headXRef.current;
        targetCharX = normX * width;
      }

      // Clamp character within safe canvas margins
      const charMargin = 85 * dpr;
      targetCharX = Math.max(charMargin, Math.min(width - charMargin, targetCharX));

      // Smooth horizontal gliding interpolation
      char.x = char.x + (targetCharX - char.x) * 0.18;
      char.y = height * 0.82;

      // Character idle breathing & catch bounce
      if (!isPaused) {
        char.idlePhase += 0.04;
        if (char.catchTimer > 0) {
          char.catchTimer -= dt;
          char.catchBounce = Math.sin(char.catchTimer * 18) * 14 * dpr;
        } else {
          char.catchBounce = 0;
        }
      }

      const charCenterY = char.y + Math.sin(char.idlePhase) * (6 * dpr) - char.catchBounce;
      const charRadius = 55 * dpr;

      for (let i = 0; i < currentStars.length; i++) {
        const s = currentStars[i];
        let collected = false;

        if (!isPaused) {
          s.y += s.speedY * 60 * dt * dpr;
          s.wobblePhase += s.wobbleSpeed;
          s.x += Math.sin(s.wobblePhase) * s.wobbleAmp * dpr;
          s.rotation += s.rotationSpeed;

          // Forgiving Star-Cloud Collision Check
          const dx = char.x - s.x;
          const dy = charCenterY - s.y;
          const dist = Math.hypot(dx, dy);

          if (dist <= charRadius + s.radius * dpr + 25 * dpr) {
            collected = true;

            // Trigger gentle chime
            soundManager.playStarChime(collectedRef.current);

            // Trigger character celebratory bounce
            char.catchTimer = 0.45;

            // Burst golden star & dust particles
            const pCount = 18;
            for (let p = 0; p < pCount; p++) {
              const angle = (Math.PI * 2 * p) / pCount + (Math.random() - 0.5) * 0.5;
              const spd = (2.2 + Math.random() * 4.5) * dpr;
              particlesRef.current.push({
                id: ++nextIdRef.current,
                x: s.x,
                y: s.y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd - 1.2 * dpr,
                radius: (2.5 + Math.random() * 3.5) * dpr,
                color: p % 2 === 0 ? "#FFE156" : "#FFFFFF",
                alpha: 1.0,
                life: 0,
                maxLife: 26 + Math.random() * 12,
                isStar: p % 3 === 0,
              });
            }

            // Notify parent to increment star count and show next comforting message
            onCollectRef.current();

            // If this was the final star, play the warm sunrise chord!
            if (collectedRef.current + 1 >= targetStars) {
              soundManager.playSunriseCelebration();
            }
          }
        }

        if (!collected) {
          // If star fell off bottom, respawn it at the top
          if (s.y > height + s.radius * dpr + 20 * dpr) {
            remainingStars.push(spawnStar(width, true));
          } else {
            remainingStars.push(s);

            // Render Star
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.rotation);

            const sr = s.radius * dpr;

            // Star Outer Glow Halo
            ctx.shadowColor = s.glowColor;
            ctx.shadowBlur = 18 * dpr;

            // Soft radiant glow circle
            const glowGrad = ctx.createRadialGradient(0, 0, sr * 0.2, 0, 0, sr * 1.8);
            glowGrad.addColorStop(0, "rgba(255, 235, 120, 0.7)");
            glowGrad.addColorStop(0.5, "rgba(255, 215, 60, 0.2)");
            glowGrad.addColorStop(1, "rgba(255, 215, 60, 0)");
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(0, 0, sr * 1.8, 0, Math.PI * 2);
            ctx.fill();

            // Star 5-Point Shape
            const starFill = ctx.createRadialGradient(-sr * 0.2, -sr * 0.2, 0, 0, 0, sr);
            starFill.addColorStop(0, "#FFFFFF");
            starFill.addColorStop(0.35, "#FFF176");
            starFill.addColorStop(1, "#FBC02D");
            ctx.fillStyle = starFill;
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 1.8 * dpr;
            drawStar(ctx, 0, 0, 5, sr, sr * 0.48);
            ctx.fill();
            ctx.stroke();

            // Center highlight sparkle
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(-sr * 0.2, -sr * 0.2, sr * 0.16, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
          }
        }
      }

      // Maintain star count (2-3 stars floating at a time for calm, unhurried collection)
      while (remainingStars.length < 3) {
        remainingStars.push(spawnStar(width, true));
      }
      starsRef.current = remainingStars;

      // =========================================================================
      // 5. STAR BURST PARTICLES
      // =========================================================================
      const nextParticles: Particle[] = [];
      for (const p of particlesRef.current) {
        if (!isPaused) {
          p.x += p.vx * 60 * dt;
          p.y += p.vy * 60 * dt;
          p.vy += 0.08 * dpr; // soft gravity
          p.life++;
          p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        }

        if (p.alpha > 0.04) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8 * dpr;

          if (p.isStar) {
            ctx.translate(p.x, p.y);
            drawStar(ctx, 0, 0, 4, p.radius, p.radius * 0.4);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          nextParticles.push(p);
        }
      }
      particlesRef.current = nextParticles;

      // =========================================================================
      // 6. CONTROLLABLE CLOUD CHARACTER ("CLOUDY")
      // =========================================================================
      ctx.save();
      ctx.translate(char.x, charCenterY);

      // Cloud shadow on ground
      ctx.fillStyle = "rgba(32, 33, 63, 0.15)";
      ctx.beginPath();
      ctx.ellipse(0, 52 * dpr + char.catchBounce * 0.5, 68 * dpr, 14 * dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Fluffy White/Pastel Cloud Body
      ctx.shadowColor = "rgba(32, 33, 63, 0.18)";
      ctx.shadowBlur = 14 * dpr;

      // Cloud Puffs
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#20213F";
      ctx.lineWidth = 3 * dpr;

      // Left puff
      ctx.beginPath();
      ctx.arc(-36 * dpr, 6 * dpr, 28 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Right puff
      ctx.beginPath();
      ctx.arc(36 * dpr, 6 * dpr, 28 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Top center puff
      ctx.beginPath();
      ctx.arc(0, -14 * dpr, 36 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Center body overlap fill (to smooth interior)
      ctx.beginPath();
      ctx.arc(0, 4 * dpr, 38 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // Cute Rosy Pastel Cheeks
      ctx.fillStyle = "rgba(255, 145, 175, 0.55)";
      ctx.beginPath();
      ctx.ellipse(-26 * dpr, 10 * dpr, 7 * dpr, 4.5 * dpr, 0, 0, Math.PI * 2);
      ctx.ellipse(26 * dpr, 10 * dpr, 7 * dpr, 4.5 * dpr, 0, 0, Math.PI * 2);
      ctx.fill();

      // Expressive Eyes
      ctx.fillStyle = "#20213F";
      if (char.catchTimer > 0) {
        // Joyful smiling eye arches ^ ^
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = "#20213F";
        ctx.beginPath();
        ctx.arc(-14 * dpr, 3 * dpr, 6 * dpr, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(14 * dpr, 3 * dpr, 6 * dpr, Math.PI, 0);
        ctx.stroke();
      } else {
        // Cute open eyes with catchlight sparkle
        ctx.beginPath();
        ctx.ellipse(-14 * dpr, 3 * dpr, 5 * dpr, 6.5 * dpr, 0, 0, Math.PI * 2);
        ctx.ellipse(14 * dpr, 3 * dpr, 5 * dpr, 6.5 * dpr, 0, 0, Math.PI * 2);
        ctx.fill();

        // White highlight sparkles in eyes
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(-15.5 * dpr, 1 * dpr, 2 * dpr, 0, Math.PI * 2);
        ctx.arc(12.5 * dpr, 1 * dpr, 2 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sweet Gentle Smile
      ctx.lineWidth = 2.8 * dpr;
      ctx.strokeStyle = "#20213F";
      ctx.lineCap = "round";
      ctx.beginPath();
      if (char.catchTimer > 0) {
        ctx.arc(0, 10 * dpr, 9 * dpr, 0.1, Math.PI - 0.1);
      } else {
        ctx.arc(0, 8 * dpr, 7 * dpr, 0.15, Math.PI - 0.15);
      }
      ctx.stroke();

      ctx.restore();

      // =========================================================================
      // 7. COMFORTING MESSAGE DISPLAY
      // =========================================================================
      const msg = messageRef.current;
      if (msg) {
        ctx.save();
        const bannerY = 46 * dpr;
        const bannerW = Math.min(width * 0.9, 640 * dpr);
        const bannerH = 44 * dpr;

        // Frosted Glass Banner Card
        ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
        ctx.shadowColor = "rgba(32, 33, 63, 0.15)";
        ctx.shadowBlur = 12 * dpr;

        const bx = width * 0.5 - bannerW * 0.5;
        const by = bannerY;
        const br = 22 * dpr;

        ctx.beginPath();
        ctx.roundRect(bx, by, bannerW, bannerH, br);
        ctx.fill();

        ctx.strokeStyle = "#20213F";
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();

        // Banner Text
        ctx.font = `bold ${Math.floor(15 * dpr)}px Fredoka, sans-serif`;
        ctx.fillStyle = "#20213F";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(msg, width * 0.5, by + bannerH * 0.5);

        ctx.restore();
      }
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", updateSize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [spawnStar, targetStars]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full cursor-ew-resize z-10"
    />
  );
}
