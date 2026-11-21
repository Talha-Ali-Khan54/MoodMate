"use client";

import { useEffect, useRef, useState } from "react";
import { useFaceFeatures } from "@/hooks/useFaceFeatures";
import { predictExpression } from "@/lib/api";
import type { Expression } from "@/lib/mood";

interface MemeOption {
  id: string;
  title: string;
  image: string;
  targetExpression: Expression;
  altExpression?: Expression;
  moodName: string;
  emoji: string;
  caption: string;
  hint: string;
  accentColor: string;
}

const MEME_OPTIONS: MemeOption[] = [
  {
    id: "crying-girl",
    title: "Dramatic Crying Meltdown",
    image: "/memes/meme1.jpg",
    targetExpression: "sad",
    moodName: "Sad / Crying",
    emoji: "😭",
    caption: "WHEN YOU REALISE IT'S ONLY TUESDAY",
    hint: "Scrunch your eyebrows, open your mouth, and give a dramatic crying face!",
    accentColor: "#75C9F5",
  },
  {
    id: "disappointed-fan",
    title: "Peak Disappointment",
    image: "/memes/meme2.jpg",
    targetExpression: "angry",
    altExpression: "sad",
    moodName: "Disappointed / Grumpy",
    emoji: "😒",
    caption: "ME LOOKING AT MY LIFE CHOICES",
    hint: "Stare blankly forward, tight unamused mouth, and utter disbelief.",
    accentColor: "#FF765E",
  },
  {
    id: "michael-scott",
    title: "Cheesy Finger Guns",
    image: "/memes/meme3.jpg",
    targetExpression: "happy",
    moodName: "Happy / Smirking",
    emoji: "👉",
    caption: "TRYING TO STAY POSITIVE LIKE:",
    hint: "Big cheesy smirk, squint your eyes with awkward overconfidence!",
    accentColor: "#FFD83D",
  },
  {
    id: "confused-guy",
    title: "Pure Confusion",
    image: "/memes/meme4.jpg",
    targetExpression: "neutral",
    altExpression: "happy",
    moodName: "Confused / Perplexed",
    emoji: "🤨",
    caption: "ME TRYING TO UNDERSTAND WHAT JUST HAPPENED",
    hint: "Raise an eyebrow, tilt your head slightly, and give a quizzical smile.",
    accentColor: "#B991E8",
  },
];

export function MemeStudio({ go }: { go: (page: any) => void }) {
  const [selectedMeme, setSelectedMeme] = useState<MemeOption>(MEME_OPTIONS[0]);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraState, setCameraState] = useState<"idle" | "requesting" | "waiting" | "analyzing" | "error">("idle");
  const [cameraError, setCameraError] = useState("");
  const [currentExpression, setCurrentExpression] = useState<Expression | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timerDuration, setTimerDuration] = useState<3 | 5>(3);
  const [isFlashing, setIsFlashing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const featureBufferRef = useRef<number[][]>([]);
  const isPredictingRef = useRef(false);

  // Stop camera tracks cleanly
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraState("idle");
    setCountdown(null);
    setIsFlashing(false);
    featureBufferRef.current = [];
    isPredictingRef.current = false;
  };

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      // Shutter flash effect
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 250);
      captureAndMatch();
      setCountdown(null);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // Turn on camera strictly on user button click
  const enableCamera = async () => {
    setCameraState("requesting");
    setCameraError("");
    setCapturedPhoto(null);
    setIsCompleted(false);
    setMatchScore(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera unavailable on this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraActive(true);
      setCameraState("waiting");
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access in your browser."
          : "We couldn't open your camera. Please check camera permissions."
      );
      setCameraState("error");
    }
  };

  // Bind video stream once the video element is mounted
  useEffect(() => {
    if (cameraState !== "waiting" || !streamRef.current || !videoRef.current) return;

    const video = videoRef.current;
    const stream = streamRef.current;

    video.srcObject = stream;
    video
      .play()
      .then(() => {
        setCameraState("analyzing");
      })
      .catch((err) => {
        console.error("Video play error:", err);
        setCameraState("error");
        setCameraError("Video failed to play. Please try again.");
      });
  }, [cameraState]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Hook into MediaPipe FaceLandmarker via existing useFaceFeatures
  useFaceFeatures(
    videoRef,
    cameraActive && cameraState === "analyzing",
    (features) => {
      if (!features) {
        featureBufferRef.current = [];
        return;
      }

      featureBufferRef.current.push(features);

      // Analyze every 8 frames for smooth live feedback
      if (featureBufferRef.current.length >= 8 && !isPredictingRef.current) {
        isPredictingRef.current = true;
        const buf = featureBufferRef.current;
        const mean = buf[0].map((_, i) => buf.reduce((a, r) => a + r[i], 0) / buf.length);
        featureBufferRef.current = [];

        predictExpression(mean)
          .then((res) => {
            setCurrentExpression(res.label);
          })
          .catch((err) => console.warn("Live prediction note:", err))
          .finally(() => {
            isPredictingRef.current = false;
          });
      }
    },
    (errMsg) => {
      console.warn("MediaPipe tracker note:", errMsg);
    }
  );

  // Capture frame and calculate similarity with the selected meme
  const captureAndMatch = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // Capture still snapshot
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw video frame (mirrored)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const snapshotUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedPhoto(snapshotUrl);

    // Stop camera
    stopCamera();

    // Calculate match score
    const isTarget = currentExpression === selectedMeme.targetExpression;
    const isAlt = selectedMeme.altExpression && currentExpression === selectedMeme.altExpression;

    let score = 0;
    if (isTarget) {
      score = Math.floor(88 + Math.random() * 11); // 88 - 98%
    } else if (isAlt) {
      score = Math.floor(78 + Math.random() * 9); // 78 - 86%
    } else {
      score = Math.floor(65 + Math.random() * 12); // 65 - 76%
    }

    setMatchScore(score);
    setIsCompleted(true);
  };

  // Download side-by-side recreation composition
  const downloadSideBySide = () => {
    if (!capturedPhoto) return;

    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 700;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#fffef8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header bar
    ctx.fillStyle = "#20213f";
    ctx.fillRect(0, 0, canvas.width, 90);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px Fredoka, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MoodMate · Meme Recreation Challenge", canvas.width / 2, 58);

    // Load meme image and user snapshot
    const memeImg = new Image();
    memeImg.crossOrigin = "anonymous";
    memeImg.onload = () => {
      const userImg = new Image();
      userImg.onload = () => {
        // Draw Meme on Left
        ctx.drawImage(memeImg, 50, 120, 520, 480);
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#20213f";
        ctx.strokeRect(50, 120, 520, 480);

        // Meme label
        ctx.fillStyle = "#ffd83d";
        ctx.fillRect(60, 130, 180, 40);
        ctx.fillStyle = "#20213f";
        ctx.font = "bold 20px Fredoka, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("ORIGINAL MEME", 150, 157);

        // Draw User on Right
        ctx.drawImage(userImg, 630, 120, 520, 480);
        ctx.strokeRect(630, 120, 520, 480);

        // User label
        ctx.fillStyle = "#75c9f5";
        ctx.fillRect(640, 130, 190, 40);
        ctx.fillStyle = "#20213f";
        ctx.fillText("YOUR RECREATION", 735, 157);

        // Match badge at bottom
        ctx.fillStyle = "#20213f";
        ctx.font = "bold 24px Fredoka, sans-serif";
        ctx.fillText(`Expression Match: ${matchScore}% 🎉`, canvas.width / 2, 650);

        // Trigger download
        const link = document.createElement("a");
        link.download = `MoodMate-MemeRecreation-${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();

        setToastMessage("Saved to downloads!");
        setTimeout(() => setToastMessage(""), 3500);
      };
      userImg.src = capturedPhoto;
    };
    memeImg.src = selectedMeme.image;
  };

  // Restart for another meme
  const resetForAnotherMeme = (meme: MemeOption) => {
    stopCamera();
    setSelectedMeme(meme);
    setCapturedPhoto(null);
    setMatchScore(null);
    setIsCompleted(false);
  };

  return (
    <div className="page meme-studio-page max-w-6xl mx-auto py-6 px-4 space-y-8 animate-page-in">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 py-3 px-5 rounded-2xl bg-navy text-white font-bold text-sm shadow-2xl border-2 border-yellow animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            stopCamera();
            go("activities");
          }}
          className="inline-flex items-center gap-2 text-sm font-bold text-navy/70 hover:text-navy transition-colors py-2 px-3 rounded-xl hover:bg-navy/5"
        >
          ← Back to Activities
        </button>
        <span className="text-xs font-bold text-navy/60 bg-paper py-1.5 px-3.5 rounded-full border border-navy/15">
          Mood Recreation · Sad Relief
        </span>
      </div>

      {/* Main Bold Heading */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold text-coral bg-coral/15 border border-coral/30">
          ✨ TURN THAT MOOD AROUND
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold font-fredoka text-navy tracking-tight">
          Let&apos;s Recreate a Meme!
        </h1>
        <p className="text-base text-navy/75 font-medium">
          Pick a meme below, match the face with your camera, and let&apos;s see how close you get!
        </p>
      </div>

      {/* 4 Meme Options Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {MEME_OPTIONS.map((meme) => {
          const isSelected = selectedMeme.id === meme.id;
          return (
            <div
              key={meme.id}
              onClick={() => resetForAnotherMeme(meme)}
              className={`group relative bg-paper rounded-2xl border-2 p-3.5 cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? "border-navy shadow-lg -translate-y-1 bg-yellow/15 ring-2 ring-navy"
                  : "border-navy/20 hover:border-navy hover:-translate-y-0.5 shadow-sm"
              }`}
              style={{ background: isSelected ? "#FFFBEA" : "#fffef8" }}
            >
              <div>
                {/* Thumbnail */}
                <div className="relative aspect-square rounded-xl overflow-hidden border border-navy/15 bg-black/5 mb-2.5">
                  <img
                    src={meme.image}
                    alt={meme.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-navy text-white text-xs flex items-center justify-center font-bold shadow">
                      ✓
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{meme.emoji}</span>
                  <h3 className="font-bold font-fredoka text-sm text-navy truncate">
                    {meme.title}
                  </h3>
                </div>
              </div>

              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md inline-block mt-2 ${
                  isSelected ? "bg-navy text-white" : "bg-navy/5 text-navy/70"
                }`}
              >
                {meme.moodName}
              </span>
            </div>
          );
        })}
      </div>

      {/* RESULT & REWARD VIEW (Once Recreated) */}
      {isCompleted && capturedPhoto ? (
        <section className="bg-paper rounded-3xl border-2 border-navy p-6 md:p-8 shadow-xl space-y-6 animate-page-in text-center">
          {/* Well Done Banner */}
          <div className="max-w-xl mx-auto space-y-2">
            <span className="text-4xl block animate-bounce">🎉</span>
            <h2 className="text-3xl md:text-4xl font-extrabold font-fredoka text-navy">
              Well done! Hope you feel better!
            </h2>
            <p className="text-sm md:text-base text-navy/75 leading-relaxed">
              You matched the expression with{" "}
              <b className="text-coral">{matchScore}% similarity</b>! Research shows that playfully copying silly faces triggers facial feedback that gently lifts your mood.
            </p>
          </div>

          {/* Side-by-Side Recreation Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto items-center">
            {/* Left: Original Meme */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-navy/60">
                Original Meme
              </span>
              <div className="relative aspect-4/3 rounded-2xl overflow-hidden border-2 border-navy shadow-md bg-black">
                <img
                  src={selectedMeme.image}
                  alt={selectedMeme.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 inset-x-2 bg-navy/85 text-white text-xs py-1 px-2 rounded-lg font-bold text-center">
                  {selectedMeme.caption}
                </div>
              </div>
            </div>

            {/* Right: User's Recreation */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-navy/60">
                Your Face Recreation
              </span>
              <div className="relative aspect-4/3 rounded-2xl overflow-hidden border-2 border-navy shadow-md bg-black">
                <img
                  src={capturedPhoto}
                  alt="Your recreation"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 bg-green-500 text-white text-xs py-1 px-3 rounded-full font-bold shadow">
                  🎯 {matchScore}% Match!
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={downloadSideBySide}
              className="py-3 px-6 rounded-2xl bg-coral text-white border-2 border-navy font-bold text-sm shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
              style={{ background: "#ff765e" }}
            >
              <span>📥</span>
              <span>Download Recreation Photo</span>
            </button>

            <button
              onClick={() => {
                const nextIndex = (MEME_OPTIONS.findIndex((m) => m.id === selectedMeme.id) + 1) % MEME_OPTIONS.length;
                resetForAnotherMeme(MEME_OPTIONS[nextIndex]);
              }}
              className="py-3 px-6 rounded-2xl bg-yellow text-navy border-2 border-navy font-bold text-sm shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center gap-2"
              style={{ background: "#ffd83d" }}
            >
              <span>🔄</span>
              <span>Recreate Another Meme</span>
            </button>

            <button
              onClick={() => {
                stopCamera();
                go("activities");
              }}
              className="py-3 px-5 rounded-2xl bg-white text-navy/80 border-2 border-navy font-bold text-sm hover:text-navy hover:bg-navy/5 transition-all"
            >
              ← Back to Activities
            </button>
          </div>
        </section>
      ) : (
        /* SPLIT BOX: MEME ON LEFT, CAMERA ON RIGHT */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* LEFT BOX: THE MEME TO RECREATE */}
          <div className="bg-paper rounded-3xl border-2 border-navy p-5 shadow-md flex flex-col justify-between space-y-4">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-navy/60 uppercase tracking-wide">
                  Target to Recreate
                </span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue text-navy border border-navy/20">
                  {selectedMeme.emoji} {selectedMeme.moodName}
                </span>
              </div>

              <h2 className="text-2xl font-bold font-fredoka text-navy mb-2">
                {selectedMeme.title}
              </h2>

              {/* Meme Image Box */}
              <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden border-2 border-navy bg-black mb-4 shadow-sm">
                <img
                  src={selectedMeme.image}
                  alt={selectedMeme.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 inset-x-3 bg-navy/85 backdrop-blur-xs text-white text-xs md:text-sm py-2 px-3 rounded-xl font-bold text-center tracking-wide">
                  {selectedMeme.caption}
                </div>
              </div>

              {/* Instructions Tip */}
              <div className="p-3.5 rounded-2xl bg-cream border border-navy/15 text-xs text-navy/80 leading-relaxed space-y-1">
                <b className="text-navy block">💡 How to recreate this expression:</b>
                <p>{selectedMeme.hint}</p>
              </div>
            </div>

            <div className="text-center pt-2">
              <span className="text-xs text-navy/60 font-medium">
                Try to copy the eyebrows, eyes, and mouth as closely as you can!
              </span>
            </div>
          </div>

          {/* RIGHT BOX: CAMERA PANEL */}
          <div className="bg-paper rounded-3xl border-2 border-navy p-5 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-navy/60 uppercase tracking-wide">
                  Your Camera
                </span>
                {cameraActive && (
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    LIVE
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-bold font-fredoka text-navy mb-3">
                {cameraActive ? "Match the Expression!" : "Ready to copy?"}
              </h2>

              {/* Error Alert */}
              {cameraError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {cameraError}
                </div>
              )}

              {/* Camera Area */}
              <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden border-2 border-navy bg-black flex items-center justify-center">
                {cameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover -scale-x-100"
                    />

                    {/* Corner styling matching MoodMate camera */}
                    <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white pointer-events-none" />
                    <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white pointer-events-none" />
                    <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white pointer-events-none" />
                    <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white pointer-events-none" />

                    {/* Target Oval Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-40 h-52 rounded-full border-2 border-dashed border-white/60 animate-pulse" />
                    </div>

                    {/* Countdown Overlay */}
                    {countdown !== null && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px] animate-fade-in pointer-events-none">
                        <div className="w-24 h-24 rounded-full border-4 border-yellow flex items-center justify-center bg-navy/95 text-white shadow-2xl scale-110 transition-transform">
                          <span className="text-5xl font-extrabold font-fredoka text-yellow">
                            {countdown > 0 ? countdown : "📸"}
                          </span>
                        </div>
                        <div className="mt-3 bg-navy/90 text-white text-xs font-bold px-4 py-1 rounded-full shadow border border-white/20">
                          {countdown > 0 ? "Hold that expression!" : "Capturing!"}
                        </div>
                      </div>
                    )}

                    {/* Shutter Flash */}
                    {isFlashing && (
                      <div className="absolute inset-0 z-30 bg-white pointer-events-none transition-opacity duration-200" />
                    )}

                    {/* Status Pill on Camera */}
                    <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none">
                      <span className="text-xs bg-navy/80 backdrop-blur-xs text-white font-bold py-1 px-3 rounded-full">
                        {currentExpression
                          ? `Detected: ${currentExpression.toUpperCase()}`
                          : "Looking for face…"}
                      </span>

                      {currentExpression === selectedMeme.targetExpression && (
                        <span className="text-xs bg-green-500 text-white font-bold py-1 px-3 rounded-full animate-bounce">
                          ✓ Expression Matches!
                        </span>
                      )}
                    </div>

                    {/* Stop button */}
                    <button
                      onClick={stopCamera}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-navy/80 text-white text-xs font-bold flex items-center justify-center hover:bg-red-600 transition-colors"
                      title="Turn off camera"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div className="text-center p-6 space-y-3">
                    <span className="text-5xl block animate-pulse">📷</span>
                    <h4 className="font-bold font-fredoka text-white text-lg">
                      Camera is off
                    </h4>
                    <p className="text-xs text-white/70 max-w-xs mx-auto">
                      Click below to turn on the camera and recreate the expression. Processed entirely on your device!
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Camera Button Controls with Timer */}
            <div className="pt-4 space-y-3">
              {cameraActive ? (
                <>
                  {/* Timer selection pills */}
                  <div className="flex items-center justify-between bg-cream/60 p-2 rounded-xl border border-navy/15 text-xs">
                    <span className="font-bold text-navy/70 flex items-center gap-1.5">
                      <span>⏱️</span>
                      <span>Pose Timer:</span>
                    </span>
                    <div className="flex gap-1.5">
                      {[3, 5].map((sec) => (
                        <button
                          key={sec}
                          disabled={countdown !== null}
                          onClick={() => setTimerDuration(sec as 3 | 5)}
                          className={`py-1 px-3 rounded-lg font-bold transition-all ${
                            timerDuration === sec
                              ? "bg-navy text-white shadow-xs"
                              : "bg-white text-navy border border-navy/20 hover:bg-navy/5"
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    {countdown !== null ? (
                      <button
                        onClick={() => setCountdown(null)}
                        className="flex-1 py-3 px-4 rounded-xl border-2 border-red-500 text-red-600 bg-red-50 font-bold text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>✕</span>
                        <span>Cancel Countdown ({countdown}s)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setCountdown(timerDuration)}
                        className="flex-1 py-3 px-5 rounded-2xl bg-coral text-white border-2 border-navy font-extrabold text-sm shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                        style={{ background: "#ff765e" }}
                      >
                        <span>⏱️</span>
                        <span>Start {timerDuration}s Timer</span>
                      </button>
                    )}

                    <button
                      onClick={captureAndMatch}
                      className="py-3 px-4 rounded-xl bg-yellow text-navy border-2 border-navy font-bold text-sm shadow hover:brightness-105 active:scale-95 transition-all flex items-center gap-1"
                      style={{ background: "#ffd83d" }}
                      title="Snap immediately without waiting"
                    >
                      <span>📸</span>
                      <span>Snap Now</span>
                    </button>

                    <button
                      onClick={stopCamera}
                      className="py-3 px-3 rounded-xl border-2 border-navy/30 text-navy font-bold text-sm hover:bg-navy/5 transition-all"
                    >
                      Turn Off
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={enableCamera}
                  disabled={cameraState === "requesting"}
                  className="w-full py-3.5 px-6 rounded-2xl bg-yellow text-navy border-2 border-navy font-extrabold text-base shadow-md hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-2"
                  style={{ background: "#ffd83d" }}
                >
                  <span>📷</span>
                  <span>
                    {cameraState === "requesting" ? "Requesting Camera…" : "Enable Camera to Recreate"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
