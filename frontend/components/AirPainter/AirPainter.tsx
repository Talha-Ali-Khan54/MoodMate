"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useHandLandmarker, type FingertipData } from "@/hooks/useHandLandmarker";
import { AirPainterCanvas } from "./AirPainterCanvas";
import { soundManager } from "./soundEffects";
import { NEON_COLORS, type GameScreen, type PaletteColor } from "./types";

interface AirPainterProps {
  go: (page: any) => void;
  onFinish?: (stats: { strokeCount: number }) => void;
}

type CountdownStep = "3" | "2" | "1" | "START!" | null;

export function AirPainter({ go, onFinish }: AirPainterProps) {
  const [screen, setScreen] = useState<GameScreen>("intro");
  const [currentColor, setCurrentColor] = useState<PaletteColor>(NEON_COLORS[0]);
  const [brushSize, setBrushSize] = useState<number>(10);
  const [strokeCount, setStrokeCount] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [savedArtworkUrl, setSavedArtworkUrl] = useState<string | null>(null);

  // Fullscreen / Maximize state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const screenContainerRef = useRef<HTMLDivElement | null>(null);

  // 3 -> 2 -> 1 -> START! Countdown states
  const [countdownText, setCountdownText] = useState<CountdownStep>(null);
  const [isDrawingAllowed, setIsDrawingAllowed] = useState(false);
  const countdownActiveRef = useRef(false);

  // Camera & Tracking states
  const [cameraState, setCameraState] = useState<"idle" | "requesting" | "ready" | "error">("idle");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  // High-speed direct fingertip ref (bypasses React re-render lag)
  const fingertipsRef = useRef<FingertipData[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef(0);
  const exportCanvasRef = useRef<(() => string | null) | null>(null);

  // Release camera tracks cleanly
  const stopCamera = useCallback(() => {
    sessionIdRef.current += 1;
    countdownActiveRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {}
    }

    setCameraReady(false);
    setCameraState("idle");
    fingertipsRef.current = [];
    setIsDrawingAllowed(false);
    setCountdownText(null);
  }, []);

  // Initialize camera stream
  const startCamera = useCallback(async () => {
    const session = ++sessionIdRef.current;
    setCameraError("");
    setCameraState("requesting");
    setCameraReady(false);
    setIsDrawingAllowed(false);
    setCountdownText(null);
    countdownActiveRef.current = false;
    fingertipsRef.current = [];

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Webcam is not available on this device.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      if (sessionIdRef.current !== session) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
          setCameraReady(true);
          setCameraState("ready");
        } catch (playErr: any) {
          if (playErr?.name !== "AbortError") {
            console.warn("Video playback error:", playErr);
          }
        }
      }
    } catch (err: any) {
      if (sessionIdRef.current !== session) return;

      console.error("Camera access error:", err);
      const isDenied =
        err?.name === "NotAllowedError" ||
        err?.name === "PermissionDeniedError";

      setCameraError(
        isDenied
          ? "Camera permission was denied. Please allow camera access to paint."
          : "Could not access your camera. Ensure no other application is using it."
      );
      setCameraState("error");
    }
  }, []);

  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current && node.srcObject !== streamRef.current) {
      node.srcObject = streamRef.current;
      node
        .play()
        .then(() => {
          setCameraReady(true);
          setCameraState("ready");
        })
        .catch(() => {});
    }
  }, []);

  // Hand tracking hook (feeds directly into fingertipsRef without lag)
  const { isModelLoading, hasHandDetected } = useHandLandmarker(
    videoRef,
    screen === "playing" && cameraReady && !isPaused,
    useCallback((detectedTips) => {
      fingertipsRef.current = detectedTips;
    }, []),
    useCallback((err) => {
      console.warn("HandLandmarker error:", err);
    }, [])
  );

  // Exact 3 -> 2 -> 1 -> START! Sequence
  useEffect(() => {
    if (screen !== "playing" || !cameraReady || isPaused) return;

    if (hasHandDetected && !isDrawingAllowed && !countdownActiveRef.current) {
      countdownActiveRef.current = true;

      // 3
      setCountdownText("3");
      soundManager.playCountdownBeep(false);

      // 2
      const timer2 = setTimeout(() => {
        setCountdownText("2");
        soundManager.playCountdownBeep(false);
      }, 1000);

      // 1
      const timer1 = setTimeout(() => {
        setCountdownText("1");
        soundManager.playCountdownBeep(false);
      }, 2000);

      // START!
      const timerStart = setTimeout(() => {
        setCountdownText("START!");
        soundManager.playCountdownBeep(true);
      }, 3000);

      // Begin Painting
      const timerDraw = setTimeout(() => {
        setCountdownText(null);
        setIsDrawingAllowed(true);
      }, 3800);

      return () => {
        clearTimeout(timer2);
        clearTimeout(timer1);
        clearTimeout(timerStart);
        clearTimeout(timerDraw);
      };
    }
  }, [hasHandDetected, isDrawingAllowed, screen, cameraReady, isPaused]);

  // Fullscreen / Maximize toggle
  const toggleMaximize = useCallback(() => {
    const elem = screenContainerRef.current;
    if (!elem) return;

    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Start painting session
  const startPainting = useCallback(() => {
    setStrokeCount(0);
    setIsPaused(false);
    setSavedArtworkUrl(null);
    setIsDrawingAllowed(false);
    setCountdownText(null);
    countdownActiveRef.current = false;
    fingertipsRef.current = [];
    setScreen("playing");
    startCamera();
  }, [startCamera]);

  // Finish and export artwork
  const handleFinishArtwork = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if (exportCanvasRef.current) {
      const dataUrl = exportCanvasRef.current();
      setSavedArtworkUrl(dataUrl);
    }
    stopCamera();
    soundManager.playFinishCelebration();
    setScreen("results");
    onFinish?.({ strokeCount });
  }, [stopCamera, strokeCount, onFinish]);

  const handleSelectColor = (color: PaletteColor) => {
    setCurrentColor(color);
    soundManager.playColorSwitch();
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.muted = next;
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  /* ========================================================================= */
  /* SCREEN 1: INTRO                                                           */
  /* ========================================================================= */
  if (screen === "intro") {
    return (
      <div className="page activity-page max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => go("activities")}
            style={{ backgroundColor: "#FFFFFF", color: "#20213F", border: "2px solid #20213F", boxShadow: "3px 3px 0px #20213F" }}
            className="flex items-center gap-2 py-2 px-4 rounded-xl font-bold text-sm hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
          >
            ← Back to Activities
          </button>
          <button
            onClick={toggleMute}
            style={{ backgroundColor: "#FFFFFF", color: "#20213F", border: "2px solid #20213F", boxShadow: "3px 3px 0px #20213F" }}
            className="p-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 cursor-pointer"
            title={isMuted ? "Unmute sounds" : "Mute sounds"}
          >
            {isMuted ? "🔇 Muted" : "🔊 Sound On"}
          </button>
        </div>

        <div className="bg-[#FFFDF8] rounded-3xl border-2 border-[#20213F] p-6 md:p-8 shadow-[8px_9px_0px_#20213F] mb-6 relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FFF0A6] border border-[#FFD83D] text-[#854D0E] font-extrabold text-xs uppercase tracking-wider">
                <span>✨</span>
                <span>Joyful Creative Flow</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold text-[#20213F] font-fredoka leading-tight">
                Air Painter
              </h1>

              <p className="text-lg md:text-xl text-[#20213F]/85 font-medium leading-relaxed">
                Draw glowing neon art in thin air with zero lag!
              </p>

              <p className="text-sm text-[#20213F]/75 leading-relaxed">
                Wave your index finger in front of your camera. When seen, an animated <b>3 &rarr; 2 &rarr; 1 &rarr; START!</b> sequence will count down, and your finger will paint immediate, responsive lines.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-[#FFF9ED] border border-[#20213F]/20 space-y-1">
                  <div className="font-bold text-sm text-[#20213F] flex items-center gap-1.5">
                    <span>⚡</span> Instant 1:1 Tracking
                  </div>
                  <p className="text-xs text-[#20213F]/70">
                    Direct-feed frame pipeline with zero sluggish delay.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FFF9ED] border border-[#20213F]/20 space-y-1">
                  <div className="font-bold text-sm text-[#20213F] flex items-center gap-1.5">
                    <span>⏱️</span> 3-2-1-START Countdown
                  </div>
                  <p className="text-xs text-[#20213F]/70">
                    Triggers when finger is detected, preparing the canvas.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FFF9ED] border border-[#20213F]/20 space-y-1">
                  <div className="font-bold text-sm text-[#20213F] flex items-center gap-1.5">
                    <span>⛶</span> Fullscreen Mode
                  </div>
                  <p className="text-xs text-[#20213F]/70">
                    Maximize canvas across your whole screen for an open view.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FFF9ED] border border-[#20213F]/20 space-y-1">
                  <div className="font-bold text-sm text-[#20213F] flex items-center gap-1.5">
                    <span>🎨</span> 6 Neon Shimmers
                  </div>
                  <p className="text-xs text-[#20213F]/70">
                    Switch colors, adjust brush width, and export high-res PNG.
                  </p>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button
                  type="button"
                  onClick={startPainting}
                  style={{
                    backgroundColor: "#FFD83D",
                    color: "#20213F",
                    border: "3px solid #20213F",
                    boxShadow: "5px 6px 0px #20213F",
                  }}
                  className="w-full sm:w-auto px-10 py-4 rounded-2xl font-extrabold text-xl font-fredoka hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#20213F] transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  <span>Start Air Painter</span>
                  <span className="text-2xl">➔</span>
                </button>
              </div>
            </div>

            <div className="md:col-span-5 flex flex-col items-center justify-center text-center p-6 bg-[#FFF0A6]/50 rounded-2xl border-2 border-[#20213F]">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg
                  className="w-40 h-40 animate-pulse"
                  style={{ animationDuration: "2.5s" }}
                  viewBox="0 0 160 160"
                  role="img"
                >
                  <g stroke="#FFD83D" strokeWidth="9" strokeLinecap="round">
                    <path d="M80 18V8M80 142v10M18 80H8M142 80h10M36 36l-8-8M124 36l8-8M36 124l-8 8M124 124l8 8" />
                  </g>
                  <circle cx="80" cy="80" r="52" fill="#FFD83D" />
                  <ellipse cx="62" cy="62" rx="7" ry="9" fill="#fff" />
                  <ellipse cx="98" cy="62" rx="7" ry="9" fill="#fff" />
                  <circle cx="63" cy="63" r="4" fill="#20213F" />
                  <circle cx="97" cy="63" r="4" fill="#20213F" />
                  <path d="M64 82 Q80 101 96 82" fill="none" stroke="#20213F" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
              <div className="mt-3">
                <span className="font-fredoka text-lg font-bold text-[#20213F] block">
                  Let your light flow!
                </span>
                <span className="text-xs text-[#20213F]/75">
                  Point your index finger toward the camera.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ========================================================================= */
  /* SCREEN 2: ACTIVE PAINTING                                                 */
  /* ========================================================================= */
  if (screen === "playing") {
    return (
      <div
        ref={screenContainerRef}
        className={`page activity-page max-w-6xl mx-auto px-3 py-1 flex flex-col overflow-hidden bg-[#FFFDF8] ${
          isFullscreen ? "fixed inset-0 z-50 max-w-none w-screen h-screen p-4" : ""
        }`}
        style={{
          height: isFullscreen ? "100vh" : "calc(100vh - 80px)",
          maxHeight: isFullscreen ? "100vh" : "calc(100dvh - 80px)",
        }}
      >
        {/* Top HUD Bar */}
        <div className="shrink-0 bg-[#FFFDF8] rounded-2xl border-2 border-[#20213F] px-4 py-2 shadow-[4px_4px_0px_#20213F] flex flex-wrap items-center justify-between gap-3 mb-2">
          {/* Left Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaused((p) => !p)}
              disabled={!cameraReady}
              style={{ backgroundColor: "#FFFFFF", color: "#20213F", border: "2px solid #20213F" }}
              className="py-1.5 px-3 rounded-xl font-bold text-xs shadow-[2px_2px_0px_#20213F] hover:bg-[#FFF9ED] disabled:opacity-50 cursor-pointer"
            >
              {isPaused ? "▶ Resume" : "⏸ Pause"}
            </button>

            {/* Maximize Button */}
            <button
              onClick={toggleMaximize}
              style={{ backgroundColor: "#FFFFFF", color: "#20213F", border: "2px solid #20213F" }}
              className="py-1.5 px-3 rounded-xl font-bold text-xs shadow-[2px_2px_0px_#20213F] hover:bg-[#FFF9ED] cursor-pointer flex items-center gap-1.5"
              title={isFullscreen ? "Exit Fullscreen" : "Maximize Screen"}
            >
              <span>{isFullscreen ? "⤡" : "⛶"}</span>
              <span>{isFullscreen ? "Restore" : "Maximize"}</span>
            </button>

            <button
              onClick={toggleMute}
              style={{ backgroundColor: "#FFFFFF", color: "#20213F", border: "2px solid #20213F" }}
              className="p-1.5 px-2.5 rounded-xl font-bold text-xs shadow-[2px_2px_0px_#20213F] hover:bg-[#FFF9ED] cursor-pointer"
              title={isMuted ? "Unmute sounds" : "Mute sounds"}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>
          </div>

          {/* Palette & Brush Size */}
          <div className="flex items-center gap-1.5 bg-[#FFF9ED] px-3 py-1 rounded-xl border border-[#20213F]/20">
            <span className="text-xs font-bold text-[#20213F]/70 mr-1">COLOR:</span>
            {NEON_COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => handleSelectColor(c)}
                style={{
                  backgroundColor: c.hex,
                  transform: currentColor.hex === c.hex ? "scale(1.25)" : "scale(1.0)",
                  border: currentColor.hex === c.hex ? "2.5px solid #20213F" : "1.5px solid rgba(32,33,63,0.3)",
                  boxShadow: currentColor.hex === c.hex ? `0 0 10px ${c.glow}` : "none",
                }}
                className="w-6 h-6 rounded-full transition-all cursor-pointer"
                title={c.name}
              />
            ))}

            <div className="ml-3 flex items-center gap-1 text-xs font-bold text-[#20213F]/70">
              <span>SIZE:</span>
              <input
                type="range"
                min="4"
                max="26"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-16 accent-[#FFD83D] cursor-pointer"
              />
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleFinishArtwork}
              style={{
                backgroundColor: "#A8E6C3",
                color: "#20213F",
                border: "2px solid #20213F",
                boxShadow: "2px 2px 0px #20213F",
              }}
              className="py-1.5 px-4 rounded-xl text-xs font-extrabold font-fredoka hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
            >
              ✨ Complete &amp; Save
            </button>

            <button
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                stopCamera();
                go("activities");
              }}
              style={{ backgroundColor: "#FFFFFF", color: "#20213F", border: "1.5px solid rgba(32,33,63,0.3)" }}
              className="py-1.5 px-3 rounded-xl text-xs font-bold hover:bg-red-50 hover:border-red-400 hover:text-red-600 cursor-pointer"
              title="Quit"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Main Canvas Container */}
        <div className="relative flex-1 min-h-0 w-full rounded-2xl border-3 border-[#20213F] overflow-hidden bg-[#0B0C18] shadow-[6px_7px_0px_#20213F]">
          {/* Mirrored Camera Feed */}
          <video
            ref={handleVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover -scale-x-100 z-0 opacity-40 mix-blend-screen"
          />

          {/* Real-time Fast Canvas */}
          {cameraReady && (
            <AirPainterCanvas
              fingertipsRef={fingertipsRef}
              isPlaying={screen === "playing"}
              isPaused={isPaused}
              isDrawingAllowed={isDrawingAllowed}
              currentColor={currentColor}
              brushSize={brushSize}
              onStrokeCountChange={setStrokeCount}
              exportRef={exportCanvasRef}
            />
          )}

          {/* 3 -> 2 -> 1 -> START! Overlay */}
          {countdownText !== null && (
            <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center select-none pointer-events-none">
              <div className="relative flex flex-col items-center justify-center">
                <div
                  key={countdownText}
                  className="w-40 h-40 md:w-48 md:h-48 rounded-full border-4 border-[#20213F] flex items-center justify-center shadow-[6px_6px_0px_#20213F] transition-all transform animate-in zoom-in-75 duration-200"
                  style={{
                    backgroundColor: countdownText === "START!" ? "#A8E6C3" : "#FFD83D",
                  }}
                >
                  <span
                    className={`font-fredoka font-extrabold text-[#20213F] leading-none ${
                      countdownText === "START!"
                        ? "text-4xl md:text-5xl tracking-wide"
                        : "text-7xl md:text-8xl"
                    }`}
                  >
                    {countdownText}
                  </span>
                </div>

                <div className="mt-4 px-5 py-2 rounded-2xl bg-[#FFFDF8] border-2 border-[#20213F] shadow-[3px_3px_0px_#20213F]">
                  <p className="font-fredoka text-sm md:text-base font-bold text-[#20213F]">
                    {countdownText === "START!"
                      ? "✨ Paint freely in the air! ✨"
                      : "Hold your finger in position..."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Hint when finger is not yet seen */}
          {cameraReady && !hasHandDetected && !isPaused && countdownText === null && !isDrawingAllowed && (
            <div className="absolute top-5 inset-x-0 mx-auto w-fit z-20 px-6 py-2.5 rounded-full bg-[#20213F]/90 backdrop-blur-md text-white font-fredoka text-sm border border-white/20 shadow-lg flex items-center gap-2 animate-pulse">
              <span>☝️</span>
              <span>Point with your index finger toward the camera to start countdown!</span>
            </div>
          )}

          {/* Status Badge */}
          {isDrawingAllowed && (
            <div className="absolute top-3 left-3 z-20 px-3 py-1 rounded-xl bg-black/70 backdrop-blur-md text-[#A8E6C3] border border-[#A8E6C3]/40 font-fredoka text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#A8E6C3] animate-ping" />
              <span>Canvas Active · Real-time 1:1 speed</span>
            </div>
          )}

          {/* Camera Loading Overlay */}
          {cameraState === "requesting" && (
            <div className="absolute inset-0 bg-[#FFFDF8] z-30 flex flex-col items-center justify-center space-y-4 p-6 text-center">
              <div className="w-12 h-12 border-4 border-[#FFD83D] border-t-transparent rounded-full animate-spin" />
              <h3 className="text-xl font-bold font-fredoka text-[#20213F]">
                Starting Air Painter camera…
              </h3>
              <p className="text-sm text-[#20213F]/70 max-w-sm">
                Please allow camera access in your browser.
              </p>
            </div>
          )}

          {/* Model Loading State */}
          {cameraState === "ready" && isModelLoading && (
            <div className="absolute inset-0 bg-black/60 z-30 flex flex-col items-center justify-center space-y-3 p-6 text-center text-white">
              <div className="w-10 h-10 border-4 border-[#FFD83D] border-t-transparent rounded-full animate-spin" />
              <span className="font-fredoka text-lg font-bold">
                Preparing Hand Landmarker…
              </span>
            </div>
          )}

          {/* Camera Error Display */}
          {cameraState === "error" && (
            <div className="absolute inset-0 bg-[#FFFDF8] z-30 flex flex-col items-center justify-center space-y-4 p-6 text-center">
              <span className="text-4xl">📷</span>
              <h3 className="text-xl font-bold font-fredoka text-[#20213F]">
                Camera couldn’t be opened
              </h3>
              <p className="text-sm text-[#20213F]/70 max-w-md">{cameraError}</p>
              <button
                onClick={startCamera}
                style={{ backgroundColor: "#FFD83D", color: "#20213F", border: "2px solid #20213F" }}
                className="px-5 py-2.5 rounded-xl font-bold text-sm shadow-[3px_3px_0px_#20213F] cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ========================================================================= */
  /* SCREEN 3: RESULTS                                                         */
  /* ========================================================================= */
  return (
    <div className="page activity-page max-w-3xl mx-auto px-4 py-8">
      <div className="bg-[#FFFDF8] rounded-3xl border-2 border-[#20213F] p-6 md:p-8 shadow-[8px_9px_0px_#20213F] space-y-7 text-center">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-[#FFF0A6] border-2 border-[#20213F] flex items-center justify-center shadow-[4px_4px_0px_#20213F]">
            <span className="text-4xl animate-bounce">🎨</span>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#A8E6C3] border border-[#20213F]/20 text-[#20213F] uppercase tracking-wider">
            CREATIVE FLOW COMPLETE
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#20213F] font-fredoka">
            Your Glowing Masterpiece!
          </h1>
          <p className="text-base text-[#20213F]/75 max-w-lg mx-auto">
            You channeled your energy into brilliant, radiant strokes of light.
          </p>
        </div>

        {savedArtworkUrl && (
          <div className="relative mx-auto max-w-lg rounded-2xl border-3 border-[#20213F] bg-[#0B0C18] p-2 shadow-[5px_5px_0px_#20213F] overflow-hidden">
            <img
              src={savedArtworkUrl}
              alt="Your neon air painting"
              className="w-full h-auto rounded-xl max-h-72 object-contain"
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          {savedArtworkUrl && (
            <a
              href={savedArtworkUrl}
              download="moodmate-air-painting.png"
              style={{
                backgroundColor: "#FFD83D",
                color: "#20213F",
                border: "2.5px solid #20213F",
                boxShadow: "4px 4px 0px #20213F",
              }}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-extrabold text-base font-fredoka hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <span>📥 Download Artwork</span>
            </a>
          )}

          <button
            onClick={startPainting}
            style={{
              backgroundColor: "#A8E6C3",
              color: "#20213F",
              border: "2px solid #20213F",
              boxShadow: "4px 4px 0px #20213F",
            }}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-base hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
          >
            🔄 Paint Again
          </button>

          <button
            onClick={() => go("activities")}
            style={{
              backgroundColor: "#FFFFFF",
              color: "#20213F",
              border: "2px solid #20213F",
              boxShadow: "4px 4px 0px #20213F",
            }}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-base hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
          >
            ← Back to Activities
          </button>
        </div>
      </div>
    </div>
  );
}