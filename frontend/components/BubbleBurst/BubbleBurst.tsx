"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useHandLandmarker, type FingertipData } from "@/hooks/useHandLandmarker";
import { BubbleBurstCanvas } from "./BubbleBurstCanvas";
import { soundManager } from "./soundEffects";
import type { GameScreen, EncouragementToast } from "./types";

interface BubbleBurstProps {
  go: (page: any) => void;
  onFinish?: (stats: { score: number; popped: number }) => void;
}

const ENCOURAGEMENTS = [
  { text: "Nice one!", emoji: "💥" },
  { text: "Great catch!", emoji: "✨" },
  { text: "Keep going!", emoji: "⚡" },
  { text: "You're on fire!", emoji: "🔥" },
  { text: "Pop that stress!", emoji: "🫧" },
  { text: "Tension fading away!", emoji: "🌈" },
];

export function BubbleBurst({ go, onFinish }: BubbleBurstProps) {
  const [screen, setScreen] = useState<GameScreen>("intro");
  const [score, setScore] = useState(0);
  const [poppedCount, setPoppedCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Camera & Tracking states
  const [cameraState, setCameraState] = useState<"idle" | "requesting" | "ready" | "error">("idle");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [fingertips, setFingertips] = useState<FingertipData[]>([]);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });

  // Floating feedback banner
  const [toast, setToast] = useState<EncouragementToast | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPopTimeRef = useRef(0);

  // Release camera hardware tracks cleanly
  const stopCamera = useCallback(() => {
    sessionIdRef.current += 1;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore release errors
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {
        // Ignore
      }
    }

    setCameraReady(false);
    setCameraState("idle");
    setFingertips([]);
  }, []);

  // Initialize camera stream
  const startCamera = useCallback(async () => {
    const session = ++sessionIdRef.current;
    setCameraError("");
    setCameraState("requesting");
    setCameraReady(false);

    // Stop lingering tracks if any
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
        throw new Error("Webcam is not available on this device or browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      // Discard if session changed while awaiting getUserMedia
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

      const msg = isDenied
        ? "Camera permission was denied. Please allow camera access in your browser to play."
        : "Could not access your camera. Please ensure no other application is using it.";

      setCameraError(msg);
      setCameraState("error");
    }
  }, []);

  // Callback ref for video element to immediately bind stream
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
        .catch((err) => {
          if (err?.name !== "AbortError") {
            console.warn("Video mount playback error:", err);
          }
        });
    }
  }, []);

  // Hand tracking hook
  const { isModelLoading, hasHandDetected } = useHandLandmarker(
    videoRef,
    screen === "playing" && cameraReady && !isPaused,
    useCallback((detectedTips, _raw, dims) => {
      setFingertips(detectedTips);
      if (dims.width > 0 && dims.height > 0) {
        setVideoDimensions(dims);
      }
    }, []),
    useCallback((err) => {
      console.warn("HandLandmarker error:", err);
    }, [])
  );

  // Start new game session
  const startGame = useCallback(() => {
    setScore(0);
    setPoppedCount(0);
    setCombo(0);
    setMaxCombo(0);
    setTimeRemaining(30);
    setIsPaused(false);
    setScreen("playing");
    startCamera();
  }, [startCamera]);

  // Restart game session while currently in game
  const restartGame = useCallback(() => {
    setScore(0);
    setPoppedCount(0);
    setCombo(0);
    setTimeRemaining(30);
    setIsPaused(false);
  }, []);

  // Handle countdown timer
  useEffect(() => {
    if (screen !== "playing" || isPaused || !cameraReady) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          timerIntervalRef.current = null;
          // Game finished!
          stopCamera();
          soundManager.playCelebration();
          setScreen("results");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [screen, isPaused, cameraReady, stopCamera]);

  // Bubble pop event handler
  const handleBubblePopped = useCallback((pts: number, isSpecial = false) => {
    const now = performance.now();
    const timeSinceLast = now - lastPopTimeRef.current;
    lastPopTimeRef.current = now;

    setScore((s) => s + pts);
    setPoppedCount((p) => p + 1);

    // Combo streak logic (within 1.8 seconds)
    setCombo((currentCombo) => {
      const newCombo = timeSinceLast < 1800 ? currentCombo + 1 : 1;
      setMaxCombo((max) => Math.max(max, newCombo));

      // Occasional encouraging feedback toast
      if (newCombo === 3 || newCombo === 6 || newCombo === 10 || isSpecial) {
        const item = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
        setToast({
          id: now,
          text: isSpecial ? "SPARK BURST!" : item.text,
          emoji: isSpecial ? "⚡" : item.emoji,
          color: isSpecial ? "#FFE156" : "#FF765E",
          timestamp: now,
        });

        setTimeout(() => {
          setToast((curr) => (curr?.id === now ? null : curr));
        }, 1500);
      }

      return newCombo;
    });
  }, []);

  // Toggle sound mute
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.muted = next;
  };

  // Clean up completely on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [stopCamera]);

  // Call onFinish callback if provided
  useEffect(() => {
    if (screen === "results") {
      onFinish?.({ score, popped: poppedCount });
    }
  }, [screen, score, poppedCount, onFinish]);

  /* ========================================================================= */
  /* SCREEN 1: INTRODUCTION                                                    */
  /* ========================================================================= */
  if (screen === "intro") {
    return (
      <div className="page activity-page max-w-5xl mx-auto px-4 py-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => go("activities")}
            className="flex items-center gap-2 py-2 px-4 rounded-xl bg-white border-2 border-[#20213F] font-bold text-sm text-[#20213F] shadow-[3px_3px_0px_#20213F] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_#20213F] transition-all"
          >
            ← Back to Activities
          </button>
          <button
            onClick={toggleMute}
            className="p-2.5 rounded-xl bg-white border-2 border-[#20213F] text-[#20213F] shadow-[3px_3px_0px_#20213F] text-sm font-bold flex items-center gap-1.5"
            title={isMuted ? "Unmute sounds" : "Mute sounds"}
          >
            {isMuted ? "🔇 Muted" : "🔊 Sound On"}
          </button>
        </div>

        {/* Hero Card */}
        <div className="bg-[#FFFDF8] rounded-3xl border-2 border-[#20213F] p-6 md:p-10 shadow-[8px_9px_0px_#20213F] mb-8 relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Left Content */}
            <div className="md:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE0D9] border border-[#FF765E] text-[#FF765E] font-bold text-xs uppercase tracking-wider">
                <span>🔥</span>
                <span>Stress & Frustration Release</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold text-[#20213F] font-fredoka leading-tight">
                Bubble Burst
              </h1>

              <p className="text-lg md:text-xl text-[#20213F]/80 font-medium leading-relaxed">
                Take a moment, move your hands, and burst away the bubbles!
              </p>

              <p className="text-sm text-[#20213F]/70 leading-relaxed">
                Feeling angry, tense, or overwhelmed? Release that physical frustration through a quick, satisfying hand-tracking mini-game. Point with your index fingers and pop every bubble that crosses your screen!
              </p>

              {/* Instructions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-[#FFF9ED] border border-[#20213F]/15 space-y-1">
                  <div className="font-bold text-sm text-[#20213F] flex items-center gap-1.5">
                    <span>🖐</span> Wave Both Hands
                  </div>
                  <p className="text-xs text-[#20213F]/70">
                    Use your index fingertips. MediaPipe tracks both hands simultaneously.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FFF9ED] border border-[#20213F]/15 space-y-1">
                  <div className="font-bold text-sm text-[#20213F] flex items-center gap-1.5">
                    <span>🫧</span> Pop for Points
                  </div>
                  <p className="text-xs text-[#20213F]/70">
                    Small bubbles yield 30 pts, medium 20 pts, large 10 pts, & golden sparks 50 pts!
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FFF9ED] border border-[#20213F]/15 space-y-1">
                  <div className="font-bold text-sm text-[#20213F] flex items-center gap-1.5">
                    <span>⏱</span> 30-Second Rush
                  </div>
                  <p className="text-xs text-[#20213F]/70">
                    A quick burst to refocus energy and clear mental static.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FFF9ED] border border-[#20213F]/15 space-y-1">
                  <div className="font-bold text-sm text-[#20213F] flex items-center gap-1.5">
                    <span>🛡</span> 100% On-Device
                  </div>
                  <p className="text-xs text-[#20213F]/70">
                    Your camera feed never leaves your browser. Zero video is saved.
                  </p>
                </div>
              </div>

              {/* Camera Note & CTA */}
              <div className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-[#20213F]/60">
                  <span>📷</span>
                  <span>Camera access is requested only after you click Start Game.</span>
                </div>

                <button
                  onClick={startGame}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#FF765E] text-white font-extrabold text-lg font-fredoka border-2 border-[#20213F] shadow-[5px_5px_0px_#20213F] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#20213F] transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  <span>Start Game</span>
                  <span className="text-xl">➔</span>
                </button>
              </div>
            </div>

            {/* Right Mascot Artwork */}
            <div className="md:col-span-5 flex flex-col items-center justify-center text-center p-6 bg-[#FFE0D9]/50 rounded-2xl border-2 border-[#20213F]">
              <div className="relative w-48 h-48 flex items-center justify-center">
                {/* Visual Animated Spark Mascot */}
                <svg
                  className="w-44 h-44 animate-bounce"
                  style={{ animationDuration: "2.5s" }}
                  viewBox="0 0 160 160"
                  role="img"
                  aria-label="Spark mascot"
                >
                  <path
                    d="m80 20 13 17 20-11 3 22 23-1-8 21 20 10-17 15 13 19-22 5 2 23-21-8-10 20-16-17-17 16-10-21-22 7 3-23-22-6 14-18L8 75l21-9-7-22 23 2 4-22 20 12 11-16Z"
                    fill="#FF765E"
                    stroke="#20213F"
                    strokeWidth="3.5"
                  />
                  <path d="m56 55 17 7" stroke="#20213F" strokeWidth="4" strokeLinecap="round" />
                  <path d="m104 55-17 7" stroke="#20213F" strokeWidth="4" strokeLinecap="round" />
                  <ellipse cx="62" cy="68" rx="7" ry="9" fill="#fff" />
                  <ellipse cx="98" cy="68" rx="7" ry="9" fill="#fff" />
                  <circle cx="63" cy="69" r="4" fill="#20213F" />
                  <circle cx="97" cy="69" r="4" fill="#20213F" />
                  <circle cx="64.5" cy="67" r="1.2" fill="#fff" />
                  <circle cx="98.5" cy="67" r="1.2" fill="#fff" />
                  <path d="M68 89 Q80 97 92 89" fill="none" stroke="#20213F" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>

              <div className="mt-4">
                <span className="font-fredoka text-lg font-bold text-[#20213F] block">
                  Feeling heated?
                </span>
                <span className="text-xs text-[#20213F]/70">
                  Channel that high-intensity energy into popped bubbles!
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ========================================================================= */
  /* SCREEN 2: ACTIVE GAME                                                     */
  /* ========================================================================= */
  if (screen === "playing") {
    const progressPercent = (timeRemaining / 30) * 100;

    return (
      <div className="page activity-page max-w-5xl mx-auto px-4 py-4 space-y-4">
        {/* Top Game HUD Bar */}
        <div className="bg-[#FFFDF8] rounded-2xl border-2 border-[#20213F] p-4 shadow-[5px_5px_0px_#20213F] flex flex-wrap items-center justify-between gap-4">
          {/* Left: Pause, Restart, Mute */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaused((p) => !p)}
              disabled={!cameraReady}
              className="py-2 px-3.5 rounded-xl bg-white border-2 border-[#20213F] text-[#20213F] font-bold text-xs shadow-[2px_2px_0px_#20213F] hover:bg-[#FFF9ED] disabled:opacity-50 cursor-pointer"
            >
              {isPaused ? "▶ Resume" : "⏸ Pause"}
            </button>

            <button
              onClick={restartGame}
              disabled={!cameraReady}
              className="py-2 px-3 rounded-xl bg-white border-2 border-[#20213F] text-[#20213F] font-bold text-xs shadow-[2px_2px_0px_#20213F] hover:bg-[#FFF9ED] disabled:opacity-50 cursor-pointer"
              title="Restart session"
            >
              🔄 Reset
            </button>

            <button
              onClick={toggleMute}
              className="p-2 rounded-xl bg-white border-2 border-[#20213F] text-[#20213F] font-bold text-xs shadow-[2px_2px_0px_#20213F] hover:bg-[#FFF9ED] cursor-pointer"
              title={isMuted ? "Unmute sounds" : "Mute sounds"}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>
          </div>

          {/* Center: Timer & Progress */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FFE0D9] border border-[#FF765E]">
              <span className="text-sm">⏱</span>
              <span className="font-fredoka text-xl font-bold text-[#FF765E] w-8 text-center">
                {timeRemaining}s
              </span>
            </div>

            {/* Circular/Linear Progress Bar */}
            <div className="w-24 md:w-36 h-3 bg-[#E8E2D5] rounded-full overflow-hidden border border-[#20213F]/20">
              <div
                className="h-full bg-[#FF765E] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Right: Score & Popped Count */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 px-3 py-1 rounded-xl bg-[#FFD83D]/30 border border-[#FFD83D]">
              <span className="text-xs font-bold text-[#20213F]/70">SCORE</span>
              <span className="font-fredoka text-xl font-bold text-[#20213F]">
                {score}
              </span>
            </div>

            <div className="flex items-center gap-1 px-3 py-1 rounded-xl bg-[#A8E6C3]/40 border border-[#A8E6C3]">
              <span className="text-xs font-bold text-[#20213F]/70">POPPED</span>
              <span className="font-fredoka text-xl font-bold text-[#20213F]">
                {poppedCount}
              </span>
            </div>

            <button
              onClick={() => {
                stopCamera();
                go("activities");
              }}
              className="py-1.5 px-3 rounded-xl bg-white border border-[#20213F]/30 text-[#20213F] text-xs font-bold hover:bg-red-50 hover:border-red-400 hover:text-red-600"
              title="Quit game"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Main Game Screen Canvas Container */}
        <div className="relative w-full aspect-4/3 md:aspect-16/10 rounded-3xl border-3 border-[#20213F] overflow-hidden bg-black shadow-[8px_9px_0px_#20213F]">
          {/* Mirrored Camera Video Feed */}
          <video
            ref={handleVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover -scale-x-100 z-0 opacity-80"
          />

          {/* Subtle Vignette Overlay for rich bubble contrast */}
          <div className="absolute inset-0 bg-radial from-transparent via-black/20 to-black/50 pointer-events-none z-1" />

          {/* Interactive Game Canvas (Bubbles, Fingertip Cursors, Particles) */}
          {cameraReady && (
            <BubbleBurstCanvas
              fingertips={fingertips}
              videoDimensions={videoDimensions}
              isPlaying={screen === "playing"}
              isPaused={isPaused}
              onBubblePopped={handleBubblePopped}
            />
          )}

          {/* Friendly Hand Instruction Banner when hand is not detected */}
          {cameraReady && !hasHandDetected && !isPaused && (
            <div className="absolute top-5 inset-x-0 mx-auto w-fit z-20 px-5 py-2.5 rounded-full bg-[#20213F]/85 backdrop-blur-md text-white font-fredoka text-sm md:text-base border border-white/20 shadow-lg flex items-center gap-2 animate-pulse">
              <span>🖐</span>
              <span>Show your hand to start popping bubbles!</span>
            </div>
          )}

          {/* Encouragement Floating Toast */}
          {toast && (
            <div className="absolute top-18 inset-x-0 mx-auto w-fit z-20 px-6 py-2 rounded-2xl bg-white/95 text-[#20213F] border-2 border-[#20213F] shadow-[4px_4px_0px_#20213F] font-fredoka text-lg md:text-xl font-bold flex items-center gap-2 animate-bounce">
              <span>{toast.emoji}</span>
              <span style={{ color: toast.color }}>{toast.text}</span>
            </div>
          )}

          {/* Camera Loading Overlay */}
          {cameraState === "requesting" && (
            <div className="absolute inset-0 bg-[#FFFDF8] z-30 flex flex-col items-center justify-center space-y-4 p-6 text-center">
              <div className="w-12 h-12 border-4 border-[#FF765E] border-t-transparent rounded-full animate-spin" />
              <h3 className="text-xl font-bold font-fredoka text-[#20213F]">
                Starting camera & hand tracker…
              </h3>
              <p className="text-sm text-[#20213F]/70 max-w-sm">
                Please allow camera access in your browser prompt.
              </p>
            </div>
          )}

          {/* Model Loading Notice */}
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
              <p className="text-sm text-[#20213F]/70 max-w-md">
                {cameraError || "Please check your browser permissions."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={startCamera}
                  className="px-5 py-2.5 rounded-xl bg-[#FF765E] text-white font-bold text-sm border-2 border-[#20213F] shadow-[3px_3px_0px_#20213F] cursor-pointer"
                >
                  Try Again
                </button>
                <button
                  onClick={() => setScreen("intro")}
                  className="px-5 py-2.5 rounded-xl bg-white text-[#20213F] font-bold text-sm border-2 border-[#20213F] cursor-pointer"
                >
                  Back to Intro
                </button>
              </div>
            </div>
          )}

          {/* Paused Overlay */}
          {isPaused && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-30 flex flex-col items-center justify-center space-y-4 text-white">
              <h2 className="text-3xl font-bold font-fredoka text-[#FFD83D]">
                Game Paused
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsPaused(false)}
                  className="px-6 py-3 rounded-2xl bg-[#FF765E] text-white font-bold font-fredoka text-base border-2 border-white shadow-lg cursor-pointer"
                >
                  Resume
                </button>
                <button
                  onClick={restartGame}
                  className="px-5 py-3 rounded-2xl bg-white text-[#20213F] font-bold text-sm border-2 border-[#20213F] cursor-pointer"
                >
                  Restart
                </button>
              </div>
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
      <div className="bg-[#FFFDF8] rounded-3xl border-2 border-[#20213F] p-6 md:p-10 shadow-[8px_9px_0px_#20213F] space-y-8 text-center">
        {/* Header Mascot */}
        <div className="flex justify-center">
          <div className="w-32 h-32 rounded-full bg-[#FFE0D9] border-2 border-[#20213F] flex items-center justify-center shadow-[4px_4px_0px_#20213F]">
            <span className="text-6xl animate-pulse">✨</span>
          </div>
        </div>

        {/* Title & Affirmation */}
        <div className="space-y-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#A8E6C3] border border-[#20213F]/20 text-[#20213F] uppercase tracking-wider">
            SESSION COMPLETE
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#20213F] font-fredoka">
            Tension Released!
          </h1>
          <p className="text-base text-[#20213F]/75 max-w-lg mx-auto">
            You channeled that heat and burst right through it! Notice how your shoulders and hands feel right now.
          </p>
        </div>

        {/* Performance Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[#FFF9ED] border-2 border-[#20213F] shadow-[3px_3px_0px_#20213F]">
            <span className="text-xs font-bold text-[#20213F]/60 block mb-1">
              FINAL SCORE
            </span>
            <span className="text-3xl font-extrabold font-fredoka text-[#FF765E]">
              {score}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF9ED] border-2 border-[#20213F] shadow-[3px_3px_0px_#20213F]">
            <span className="text-xs font-bold text-[#20213F]/60 block mb-1">
              BUBBLES BURST
            </span>
            <span className="text-3xl font-extrabold font-fredoka text-[#75C9F5]">
              {poppedCount}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF9ED] border-2 border-[#20213F] shadow-[3px_3px_0px_#20213F]">
            <span className="text-xs font-bold text-[#20213F]/60 block mb-1">
              HIGHEST STREAK
            </span>
            <span className="text-3xl font-extrabold font-fredoka text-[#FFD83D]">
              {maxCombo}x
            </span>
          </div>
        </div>

        {/* Encouraging summary card */}
        <div className="p-4 rounded-2xl bg-[#FFE0D9]/60 border border-[#FF765E]/30 text-sm text-[#20213F] space-y-1">
          <b className="font-fredoka text-base block text-[#FF765E]">
            {poppedCount >= 25
              ? "🔥 Incredible Energy! Master Tension Buster!"
              : poppedCount >= 15
              ? "⚡ Great Burst Session! That tension is moving."
              : "🌱 Nice Start! Every bubble popped creates space."}
          </b>
          <p className="text-xs text-[#20213F]/70">
            Physical hand movement is a proven way to discharge adrenaline and interrupt spiraling thoughts.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={startGame}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#FF765E] text-white font-extrabold text-base font-fredoka border-2 border-[#20213F] shadow-[4px_4px_0px_#20213F] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#20213F] transition-all cursor-pointer"
          >
            🔄 Play Again
          </button>

          <button
            onClick={() => go("activities")}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white text-[#20213F] font-bold text-base border-2 border-[#20213F] shadow-[4px_4px_0px_#20213F] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#20213F] transition-all cursor-pointer"
          >
            ← Back to Activities
          </button>
        </div>
      </div>
    </div>
  );
}
