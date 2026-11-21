"use client";

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { MemeTemplate, CaptionField, FaceSticker, AccessorySticker } from "./types";

export interface MemeCanvasRef {
  exportImage: () => string | null;
  downloadMeme: () => void;
}

interface MemeCanvasProps {
  template: MemeTemplate;
  captions: CaptionField[];
  faceSticker: FaceSticker | null;
  accessories: AccessorySticker[];
  onUpdateFaceSticker?: (updated: Partial<FaceSticker>) => void;
  onUpdateAccessory?: (id: string, updated: Partial<AccessorySticker>) => void;
}

export const MemeCanvas = forwardRef<MemeCanvasRef, MemeCanvasProps>(function MemeCanvas(
  {
    template,
    captions,
    faceSticker,
    accessories,
    onUpdateFaceSticker,
    onUpdateAccessory,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const templateImgRef = useRef<HTMLImageElement | null>(null);
  const faceImgRef = useRef<HTMLImageElement | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState<"face" | string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialX: number; initialY: number }>({
    mouseX: 0,
    mouseY: 0,
    initialX: 50,
    initialY: 50,
  });

  // Load template image
  useEffect(() => {
    setIsLoaded(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      templateImgRef.current = img;
      setIsLoaded(true);
    };
    img.onerror = (e) => {
      console.error("Failed to load meme template:", template.image, e);
    };
    img.src = template.image;
  }, [template.image]);

  // Load face sticker image when changed
  useEffect(() => {
    if (!faceSticker?.src) {
      faceImgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      faceImgRef.current = img;
      drawCanvas();
    };
    img.src = faceSticker.src;
  }, [faceSticker?.src]);

  // Word wrap utility for meme captions
  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  };

  // Draw the full composition to the canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !templateImgRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const templateImg = templateImgRef.current;
    const cw = templateImg.naturalWidth || 800;
    const ch = templateImg.naturalHeight || 600;

    canvas.width = cw;
    canvas.height = ch;

    // 1. Draw base meme template
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(templateImg, 0, 0, cw, ch);

    // 2. Draw user face sticker if present
    if (faceSticker && faceImgRef.current) {
      const faceImg = faceImgRef.current;
      const posX = (faceSticker.x / 100) * cw;
      const posY = (faceSticker.y / 100) * ch;

      // Base width for sticker
      const baseW = cw * 0.28 * faceSticker.scale;
      const aspect = faceImg.naturalWidth / (faceImg.naturalHeight || 1);
      const drawW = baseW;
      const drawH = baseW / aspect;

      ctx.save();
      ctx.translate(posX, posY);
      ctx.rotate((faceSticker.rotation * Math.PI) / 180);

      // Shadow behind sticker
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;

      ctx.drawImage(faceImg, -drawW / 2, -drawH / 2, drawW, drawH);

      ctx.restore();
    }

    // 3. Draw accessories / effects (glasses, tears, hat, etc.)
    accessories.forEach((acc) => {
      const posX = (acc.x / 100) * cw;
      const posY = (acc.y / 100) * ch;
      const size = cw * 0.15 * acc.scale;

      ctx.save();
      ctx.translate(posX, posY);
      ctx.rotate((acc.rotation * Math.PI) / 180);

      if (acc.type === "sunglasses") {
        // Pixelated Thug Life sunglasses
        ctx.fillStyle = "#000000";
        const w2 = size * 1.5;
        const h2 = size * 0.45;
        ctx.fillRect(-w2 / 2, -h2 / 2, w2, h2);
        // White glint squares
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-w2 / 2 + 6, -h2 / 2 + 4, 10, 8);
        ctx.fillRect(w2 / 4 - 4, -h2 / 2 + 4, 10, 8);
      } else if (acc.type === "tears") {
        // Dramatic anime / comic tear streams
        ctx.fillStyle = "#75c9f5";
        ctx.strokeStyle = "#20213f";
        ctx.lineWidth = 3;

        // Left tear
        ctx.beginPath();
        ctx.ellipse(-size * 0.6, size * 0.2, size * 0.18, size * 0.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right tear
        ctx.beginPath();
        ctx.ellipse(size * 0.6, size * 0.2, size * 0.18, size * 0.5, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (acc.type === "party_hat") {
        // Party cone hat
        ctx.beginPath();
        ctx.moveTo(0, -size * 1.2);
        ctx.lineTo(-size * 0.6, size * 0.4);
        ctx.lineTo(size * 0.6, size * 0.4);
        ctx.closePath();
        ctx.fillStyle = "#ffd83d";
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#20213f";
        ctx.stroke();

        // Pom pom on top
        ctx.beginPath();
        ctx.arc(0, -size * 1.2, size * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = "#ff765e";
        ctx.fill();
        ctx.stroke();
      } else if (acc.type === "clown_nose") {
        // Red clown nose
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = "#ff3b30";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#20213f";
        ctx.stroke();

        // White highlight
        ctx.beginPath();
        ctx.arc(-size * 0.1, -size * 0.1, size * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      } else if (acc.type === "fire") {
        // Comic flame emoji
        ctx.font = `${Math.round(size)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🔥", 0, 0);
      }

      ctx.restore();
    });

    // 4. Draw bold meme typography captions
    captions.forEach((cap) => {
      const rawText = cap.text.trim();
      if (!rawText) return;

      const displayText = cap.isUppercase ? rawText.toUpperCase() : rawText;

      const posX = (cap.x / 100) * cw;
      const posY = (cap.y / 100) * ch;
      const fontSize = cap.fontSize || 32;

      ctx.save();
      // Meme font stack: Impact, Fredoka, Arial Black
      ctx.font = `900 ${fontSize}px "Fredoka", "Impact", "Arial Black", sans-serif`;
      ctx.textAlign = cap.align || "center";
      ctx.textBaseline = "middle";

      // Heavy stroke outline
      const strokeW = Math.max(5, fontSize * 0.18);
      ctx.lineWidth = strokeW;
      ctx.strokeStyle = cap.strokeColor || "#000000";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      // Fill color
      ctx.fillStyle = cap.color || "#ffffff";

      // Text wrapping: max width 90% of canvas
      const maxTextWidth = cw * 0.92;
      const lines = wrapText(ctx, displayText, maxTextWidth);
      const lineHeight = fontSize * 1.15;
      const totalH = lines.length * lineHeight;
      const startY = posY - totalH / 2 + lineHeight / 2;

      lines.forEach((line, i) => {
        const lineY = startY + i * lineHeight;
        ctx.strokeText(line, posX, lineY);
        ctx.fillText(line, posX, lineY);
      });

      ctx.restore();
    });
  }, [captions, faceSticker, accessories]);

  // Re-draw whenever inputs or image loads
  useEffect(() => {
    if (isLoaded) {
      drawCanvas();
    }
  }, [isLoaded, drawCanvas]);

  // Mouse & touch interaction for moving the face sticker on canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!faceSticker || !onUpdateFaceSticker || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // Check distance to face sticker center
    const dist = Math.hypot(clickX - faceSticker.x, clickY - faceSticker.y);
    if (dist < 18 * faceSticker.scale) {
      setIsDragging("face");
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        initialX: faceSticker.x,
        initialY: faceSticker.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStartRef.current.mouseX) / rect.width) * 100;
    const dy = ((e.clientY - dragStartRef.current.mouseY) / rect.height) * 100;

    if (isDragging === "face" && onUpdateFaceSticker) {
      const newX = Math.min(95, Math.max(5, dragStartRef.current.initialX + dx));
      const newY = Math.min(95, Math.max(5, dragStartRef.current.initialY + dy));
      onUpdateFaceSticker({ x: Math.round(newX), y: Math.round(newY) });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setIsDragging(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {
        // Ignore
      }
    }
  };

  // Expose export methods to parent
  useImperativeHandle(ref, () => ({
    exportImage: () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return canvas.toDataURL("image/png");
    },
    downloadMeme: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `MoodMate-Meme-${template.id}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
  }));

  return (
    <div className="relative w-full flex items-center justify-center p-2 rounded-2xl bg-navy/5 border-2 border-navy overflow-hidden shadow-inner">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-auto max-h-[65vh] object-contain rounded-xl shadow-lg cursor-crosshair select-none touch-none bg-paper"
      />

      {faceSticker && (
        <div className="absolute bottom-4 left-4 bg-navy/80 text-white text-[11px] font-bold px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-xs flex items-center gap-1.5">
          <span>🖐 Drag face photo to reposition</span>
        </div>
      )}
    </div>
  );
});
