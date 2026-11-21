"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useHeadTracker } from "./useHeadTracker";
import { CloudCatcherCanvas } from "./CloudCatcherCanvas";
import { soundManager } from "./soundEffects";
import { COMFORTING_MESSAGES, type GameScreen } from "./types";

interface CloudCatcherProps {
  go: (page: any) => void;
  onFinish?: (stats: { stars: number }) => void;
}

const TARGET_STARS = 8;

export function CloudCatcher({ go, onFinish }: CloudCatcherProps) {
  const [screen, setScreen] = useState<GameScreen>("intro");
  const [collectedStars, setCollectedStars] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);

  // Fullscreen / Maximize Screen State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const screenContainerRef = useRef<HTMLDivElement | null>(null);

  // Camera & Tracking states
  const [cameraState, setCameraState] = useState<"idle" | "requesting" | "ready" | "error">("idle");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef(0);
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    sessionIdRef.current += 1;

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
  }, []);

  // Start webcam
  const startCamera = useCallback(async () => {
    const session = ++sessionIdRef.current;
    setCameraError("");
    setCameraState("requesting");
    setCameraReady(false);

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

      const msg = isDenied
        ? "Camera permission was denied. Please allow camera access in your browser to play."
        : "Could not access your camera. Please ensure no other application is using it.";

      setCameraError(msg);
      setCameraState("error");
    }
  }, []);

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

  // Sync fullscreen change state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Video node ref callback
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
            console.warn("Video playback error:", err);
          }
        });
    }
  }, []);

  // Head tracking hook
  const { isModelLoading, hasFaceDetected, headXRef } = useHeadTracker(
    videoRef,
    screen === "playing" && cameraReady && !isPaused,
    undefined,
    useCallback((err: string) => {
      console.warn("HeadTracker error:", err);
    }, [])
  );

  // Start game session
  const startGame = useCallback(() => {
    setCollectedStars(0);
    setIsPaused(false);
    setCurrentMessage(null);
    setScreen("playing");
    startCamera();
  }, [startCamera]);

  // Handle star collection
  const handleStarCollected = useCallback(() => {
    setCollectedStars((prev) => {
      const next = prev + 1;

      const msgObj = COMFORTING_MESSAGES[(next - 1) % COMFORTING_MESSAGES.length];
      setCurrentMessage(`${msgObj.emoji} ${msgObj.text}`);

      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
      messageTimeoutRef.current = setTimeout(() => {
        setCurrentMessage(null);
      }, 4500);

      // Reached completion target
      if (next >= TARGET_STARS) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        setTimeout(() => {
          stopCamera();
          setScreen("completed");
          onFinish?.({ stars: TARGET_STARS });
        }, 1200);
      }

      return next;
    });
  }, [stopCamera, onFinish]);

  // Toggle sound
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.muted = next;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      stopCamera();
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, [stopCamera]);

  /* ========================================================================= */
  /* SCREEN 1: INTRODUCTION                                                    */
  /* ========================================================================= */
  if (screen === "intro") {
    return (
      <div className="page activity-page max-w-5xl mx-auto px-4 py-6">
        {/* Navigation Bar */}
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

        {/* Hero Card */}
        <div className="bg-[#FFFDF8] rounded-3xl border-2 border-[#20213F] p-6 md:p-8 shadow-[8px_9px_0px_#20213F] mb-6 relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Left Column Content */}
            <div className="md:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E0F2FE] border border-[#75C9F5] text-[#0369A1] font-extrabold text-xs uppercase tracking-wider">
                <span>☁️</span>
                <span>Sad &amp; Reflective Mood Journey</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold text-[#20213F] font-fredoka leading-tight">
                Cloud Catcher
              </h1>

              <p className="text-lg md:text-xl text-[#20213F]/85 font-medium leading-relaxed">
                A little head movement, a few stars, and a brighter sky.
              </p>

              <p className="text-sm text-[#20213F]/75 leading-relaxed">
                When you’re feeling low or overwhelmed, guide your gentle cloud using subtle head movements. As you collect comforting stars, the gloomy storm clouds softly roll away into bright, radiant sunshine.
              </p>

              {/* Instructions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-[#F0F9FF] border border-[#20213F]/20 space-y-1">
                  <div className="font-bold text-sm text-[#20213F] flex items-center gap-1.5">
                    <span>👤</span> Move Your Head
                  </div>
                  <p className="text-xs text-[#20213F]/70">
                    Tilt or move your head gently left and right to glide your cloud.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F0F9FF] border border-[#20213F]/20 space-y-1">
                  <div className="font-bold text-sm text-[#20213F] flex items-center gap-1.5">
                    <span>⭐</span> Catch 8 Stars
                  </div>
                  <p className="text-xs text-[#20213F]/70">
                    Each star collected reveals a short, comforting message just for you.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F0F9FF] border border-[#20213F]/20 space-y-1">
                  <div className="font-bold text-sm text-[#20213F] flex items-center gap-1.5">
                    <span>⛶</span> Fullscreen Mode
                  </div>
                  <p className="text-xs text-[#20213F]/70">
                    Maximize the calm, serene sky view across your entire monitor.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F0F9FF] border border-[#20213F]/20 space-y-1">
                  <div className="font-bold text-sm text-[#20213F] flex items-center gap-1.5">
                    <span>🛡️</span> 100% On-Device
                  </div>
                  <p className="text-xs text-[#20213F]/70">
                    All face tracking runs locally in your browser. Zero video is saved.
                  </p>
                </div>
              </div>

              {/* High-visibility Start Button */}
              <div className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-xs text-[#20213F]/70">
                  <span>📷</span>
                  <span>Camera activates only when you begin the activity below.</span>
                </div>

                <button
                  type="button"
                  onClick={startGame}
                  style={{
                    backgroundColor: "#75C9F5",
                    color: "#20213F",
                    border: "3px solid #20213F",
                    boxShadow: "5px 6px 0px #20213F",
                  }}
                  className="w-full sm:w-auto px-10 py-4 rounded-2xl font-extrabold text-xl font-fredoka hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#20213F] transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  <span>Start Cloud Catcher</span>
                  <span className="text-2xl">➔</span>
                </button>
              </div>
            </div>

            {/* Right Mascot Artwork */}
            <div className="md:col-span-5 flex flex-col items-center justify-center text-center p-6 bg-[#E0F2FE]/50 rounded-2xl border-2 border-[#20213F]">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg
                  className="w-40 h-40 animate-bounce"
                  style={{ animationDuration: "3s" }}
                  viewBox="0 0 160 160"
                  role="img"
                  aria-label="Cloudy mascot"
                >
                  <path
                    d="M38 112c-17 0-26-11-24-26 1-12 11-21 23-22-1-20 13-34 31-32 11-13 36-7 39 11 18-2 31 9 31 25 13 4 20 15 17 28-3 11-12 16-26 16H38Z"
                    fill="#75C9F5"
                    stroke="#20213F"
                    strokeWidth="3.5"
                  />
                  <path d="m56 59 15 2" stroke="#20213F" strokeWidth="3.5" strokeLinecap="round" />
                  <path d="m104 59-15 2" stroke="#20213F" strokeWidth="3.5" strokeLinecap="round" />
                  <ellipse cx="62" cy="68" rx="7" ry="9" fill="#fff" />
                  <ellipse cx="98" cy="68" rx="7" ry="9" fill="#fff" />
                  <circle cx="63" cy="69" r="4" fill="#20213F" />
                  <circle cx="97" cy="69" r="4" fill="#20213F" />
                  <circle cx="64.5" cy="67" r="1.2" fill="#fff" />
                  <circle cx="98.5" cy="67" r="1.2" fill="#fff" />
                  <path d="M70 92 Q80 84 90 92" fill="none" stroke="#20213F" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>

              <div className="mt-3">
                <span className="font-fredoka text-lg font-bold text-[#20213F] block">
                  Cloudy is with you.
                </span>
                <span className="text-xs text-[#20213F]/75">
                  Let’s catch some light together.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ========================================================================= */
  /* SCREEN 2: ACTIVE GAME (With Fullscreen Maximize Support)                  */
  /* ========================================================================= */
  if (screen === "playing") {
    const progressPercent = (collectedStars / TARGET_STARS) * 100;

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
        {/* Top Game HUD Bar */}
        <div className="shrink-0 bg-[#FFFDF8] rounded-2xl border-2 border-[#20213F] px-4 py-2.5 shadow-[4px_4px_0px_#20213F] flex flex-wrap items-center justify-between gap-3 mb-2">
          {/* Left: Pause, Maximize, Sound */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaused((p) => !p)}
              disabled={!cameraReady}
              style={{ backgroundColor: "#FFFFFF", color: "#20213F", border: "2px solid #20213F" }}
              className="py-1.5 px-3 rounded-xl font-bold text-xs shadow-[2px_2px_0px_#20213F] hover:bg-[#F0F9FF] disabled:opacity-50 cursor-pointer"
            >
              {isPaused ? "▶ Resume" : "⏸ Pause"}
            </button>

            {/* Maximize / Fullscreen Button */}
            <button
              onClick={toggleMaximize}
              style={{ backgroundColor: "#FFFFFF", color: "#20213F", border: "2px solid #20213F" }}
              className="py-1.5 px-3 rounded-xl font-bold text-xs shadow-[2px_2px_0px_#20213F] hover:bg-[#F0F9FF] cursor-pointer flex items-center gap-1.5"
              title={isFullscreen ? "Exit Fullscreen" : "Maximize Screen"}
            >
              <span>{isFullscreen ? "⤡" : "⛶"}</span>
              <span>{isFullscreen ? "Restore" : "Maximize"}</span>
            </button>

            <button
              onClick={toggleMute}
              style={{ backgroundColor: "#FFFFFF", color: "#20213F", border: "2px solid #20213F" }}
              className="p-1.5 px-2.5 rounded-xl font-bold text-xs shadow-[2px_2px_0px_#20213F] hover:bg-[#F0F9FF] cursor-pointer"
              title={isMuted ? "Unmute sounds" : "Mute sounds"}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>
          </div>

          {/* Center: Star Progress */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FFF9ED] border-2 border-[#20213F] shadow-[2px_2px_0px_#20213F]">
              <span className="text-base animate-pulse">⭐</span>
              <span className="font-fredoka text-lg font-bold text-[#20213F]">
                {collectedStars} / {TARGET_STARS} Stars
              </span>
            </div>

            {/* Sky Transformation Meter */}
            <div className="w-24 md:w-36 h-3 bg-[#E8E2D5] rounded-full overflow-hidden border border-[#20213F]/20">
              <div
                className="h-full bg-[#FFD83D] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Right: Exit */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                stopCamera();
                go("activities");
              }}
              style={{ backgroundColor: "#FFFFFF", color: "#20213F", border: "1.5px solid rgba(32,33,63,0.3)" }}
              className="py-1.5 px-3.5 rounded-xl text-xs font-bold hover:bg-red-50 hover:border-red-400 hover:text-red-600 cursor-pointer"
              title="Quit activity"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Main Canvas Container - Expands to 100% of remaining browser height */}
        <div className="relative flex-1 min-h-0 w-full rounded-2xl border-3 border-[#20213F] overflow-hidden shadow-[6px_7px_0px_#20213F]">
          {/* Transforming Game Canvas (Sky, Clouds, Stars, Character, Comforting Message) */}
          <CloudCatcherCanvas
            headXRef={headXRef}
            collectedStars={collectedStars}
            targetStars={TARGET_STARS}
            isPlaying={screen === "playing"}
            isPaused={isPaused}
            onStarCollected={handleStarCollected}
            currentMessage={currentMessage}
          />

          {/* Discreet, Corner Webcam Preview */}
          <div className="absolute bottom-4 right-4 z-20 w-32 md:w-36 aspect-4/3 rounded-xl border-2 border-[#20213F] bg-black/80 overflow-hidden shadow-md">
            <video
              ref={handleVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100 opacity-85"
            />
            {/* Tracking Badge */}
            <div className="absolute bottom-1 inset-x-1 text-center py-0.5 bg-[#20213F]/80 rounded text-[10px] font-bold text-white font-fredoka flex items-center justify-center gap-1">
              <span className={`w-2 h-2 rounded-full ${hasFaceDetected ? "bg-green-400" : "bg-yellow-400 animate-ping"}`} />
              <span>{hasFaceDetected ? "Head Tracking" : "Align Face"}</span>
            </div>
          </div>

          {/* Instruction Pill */}
          <div className="absolute bottom-4 left-4 z-20 px-4 py-2 rounded-xl bg-white/90 backdrop-blur-xs border border-[#20213F]/20 text-[#20213F] font-fredoka text-xs md:text-sm font-bold shadow-sm flex items-center gap-2">
            <span>↔️</span>
            <span>Move your head left &amp; right to glide Cloudy</span>
          </div>

          {/* Friendly Out-of-View Warning */}
          {cameraReady && !hasFaceDetected && !isPaused && (
            <div className="absolute top-5 inset-x-0 mx-auto w-fit z-30 px-5 py-2.5 rounded-full bg-[#20213F]/90 backdrop-blur-md text-white font-fredoka text-sm md:text-base border border-white/20 shadow-lg flex items-center gap-2 animate-pulse">
              <span>👤</span>
              <span>Come back into view so we can keep collecting stars!</span>
            </div>
          )}

          {/* Loading Overlay */}
          {cameraState === "requesting" && (
            <div className="absolute inset-0 bg-[#FFFDF8] z-40 flex flex-col items-center justify-center space-y-4 p-6 text-center">
              <div className="w-12 h-12 border-4 border-[#75C9F5] border-t-transparent rounded-full animate-spin" />
              <h3 className="text-xl font-bold font-fredoka text-[#20213F]">
                Preparing your sky…
              </h3>
              <p className="text-sm text-[#20213F]/70 max-w-sm">
                Please allow camera access so head tracking can gently guide your cloud.
              </p>
            </div>
          )}

          {/* Model Loading State */}
          {cameraState === "ready" && isModelLoading && (
            <div className="absolute inset-0 bg-black/60 z-40 flex flex-col items-center justify-center space-y-3 p-6 text-center text-white">
              <div className="w-10 h-10 border-4 border-[#FFD83D] border-t-transparent rounded-full animate-spin" />
              <span className="font-fredoka text-lg font-bold">
                Finding your position…
              </span>
            </div>
          )}

          {/* Camera Error Display */}
          {cameraState === "error" && (
            <div className="absolute inset-0 bg-[#FFFDF8] z-40 flex flex-col items-center justify-center space-y-4 p-6 text-center">
              <span className="text-4xl">📷</span>
              <h3 className="text-xl font-bold font-fredoka text-[#20213F]">
                Camera couldn’t be opened
              </h3>
              <p className="text-sm text-[#20213F]/70 max-w-md">
                {cameraError || "Please check your browser permissions or webcam connection."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={startCamera}
                  style={{ backgroundColor: "#75C9F5", color: "#20213F", border: "2px solid #20213F" }}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm shadow-[3px_3px_0px_#20213F] cursor-pointer"
                >
                  Try Again
                </button>
                <button
                  onClick={() => setScreen("intro")}
                  style={{ backgroundColor: "#FFFFFF", color: "#20213F", border: "2px solid #20213F" }}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer"
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
                Sky Paused
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsPaused(false)}
                  style={{ backgroundColor: "#75C9F5", color: "#20213F", border: "2px solid #FFFFFF" }}
                  className="px-6 py-2.5 rounded-2xl font-bold font-fredoka text-base shadow-lg cursor-pointer"
                >
                  Resume
                </button>
                <button
                  onClick={startGame}
                  style={{ backgroundColor: "#FFFFFF", color: "#20213F", border: "2px solid #20213F" }}
                  className="px-5 py-2.5 rounded-2xl font-bold text-sm cursor-pointer"
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
  /* SCREEN 3: COMPLETION                                                      */
  /* ========================================================================= */
  return (
    <div className="page activity-page max-w-3xl mx-auto px-4 py-8">
      <div className="bg-[#FFFDF8] rounded-3xl border-2 border-[#20213F] p-6 md:p-10 shadow-[8px_9px_0px_#20213F] space-y-7 text-center">
        {/* Sunny Mascot Illustration */}
        <div className="flex justify-center">
          <div className="w-28 h-28 rounded-full bg-[#FEF08A] border-2 border-[#20213F] flex items-center justify-center shadow-[4px_4px_0px_#20213F]">
            <span className="text-5xl animate-spin" style={{ animationDuration: "12s" }}>
              ☀️
            </span>
          </div>
        </div>

        {/* Title & Affirmation */}
        <div className="space-y-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FEF08A] border border-[#20213F]/20 text-[#854D0E] uppercase tracking-wider">
            THE SKY HAS CLEARED
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#20213F] font-fredoka">
            You Brought the Light Back!
          </h1>
          <p className="text-lg text-[#20213F]/85 font-medium max-w-lg mx-auto">
            “Even after cloudy days, the sky can clear again. Be gentle with yourself.”
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
          <div className="p-4 rounded-2xl bg-[#F0FDF4] border-2 border-[#20213F] shadow-[3px_3px_0px_#20213F]">
            <span className="text-xs font-bold text-[#20213F]/60 block mb-1">
              STARS COLLECTED
            </span>
            <span className="text-3xl font-extrabold font-fredoka text-[#16A34A]">
              8 / 8 ⭐
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#FEF9C3] border-2 border-[#20213F] shadow-[3px_3px_0px_#20213F]">
            <span className="text-xs font-bold text-[#20213F]/60 block mb-1">
              ATMOSPHERE
            </span>
            <span className="text-3xl font-extrabold font-fredoka text-[#CA8A04]">
              100% Sunny ☀️
            </span>
          </div>
        </div>

        {/* Calming take-away card */}
        <div className="p-4 rounded-2xl bg-[#E0F2FE]/60 border border-[#75C9F5]/40 text-sm text-[#20213F] space-y-1">
          <b className="font-fredoka text-base block text-[#0369A1]">
            Gentle reminder for the rest of your day
          </b>
          <p className="text-xs text-[#20213F]/75">
            Feelings come and go just like clouds across the sky. Take a deep breath and carry this warm sunshine with you.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={startGame}
            style={{
              backgroundColor: "#75C9F5",
              color: "#20213F",
              border: "2.5px solid #20213F",
              boxShadow: "4px 4px 0px #20213F",
            }}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-extrabold text-base font-fredoka hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
          >
            🔄 Play Again
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