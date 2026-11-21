"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { FaceSticker, FaceStickerStyle } from "./types";
import { buildFeatures } from "@/lib/features";
import { ruleBaseline } from "@/lib/api";

// Key landmark indices for the outer face oval in MediaPipe 468/478 landmarker
const FACE_CONTOUR_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109, 10,
];

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks("/mediapipe/wasm")
      .then((fileset) =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "/models/face_landmarker.task",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        })
      )
      .catch((err) => {
        landmarkerPromise = null;
        throw err;
      });
  }
  return landmarkerPromise;
}

export function MemeCameraModal({
  isOpen,
  onClose,
  onAddSticker,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAddSticker: (sticker: FaceSticker) => void;
}) {
  const [activeTab, setActiveTab] = useState<"camera" | "upload">("camera");
  const [cameraActive, setCameraActive] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [detectedExpression, setDetectedExpression] = useState<string>("neutral");
  const [stickerStyle, setStickerStyle] = useState<FaceStickerStyle>("cutout");
  const [borderColor, setBorderColor] = useState<string>("#ffffff");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const latestLandmarksRef = useRef<Array<{ x: number; y: number; z: number }> | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Stop camera tracks cleanly
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
    setCameraActive(false);
    setFaceDetected(false);
  };

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      setCapturedDataUrl(null);
      setErrorMsg("");
    }
  }, [isOpen]);

  // Start live webcam strictly on user command
  const startCamera = async () => {
    setErrorMsg("");
    setIsModelLoading(true);
    setCapturedDataUrl(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Webcam is not supported in this browser.");
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

      const lm = await getFaceLandmarker();
      landmarkerRef.current = lm;
      setIsModelLoading(false);
    } catch (err: any) {
      console.error("Camera startup error:", err);
      setIsModelLoading(false);
      stopCameraStream();
      setErrorMsg(
        err.name === "NotAllowedError"
          ? "Camera permission was denied. You can still upload a photo below."
          : "Could not open camera. Try uploading an image instead."
      );
    }
  };

  // Bind video element when camera becomes active
  useEffect(() => {
    if (!cameraActive || !streamRef.current || !videoRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn("Video playback issue:", err);
      });
    }

    let lastTime = -1;
    const detectLoop = (t: number) => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      if (landmarkerRef.current && t - lastTime > 100) {
        lastTime = t;
        try {
          const result = landmarkerRef.current.detectForVideo(videoRef.current, t);
          if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const face = result.faceLandmarks[0];
            latestLandmarksRef.current = face;
            setFaceDetected(true);

            // Predict expression locally using ruleBaseline
            try {
              const features = buildFeatures(face);
              const expr = ruleBaseline(features);
              setDetectedExpression(expr);
            } catch (e) {
              // Ignore fallback
            }
          } else {
            latestLandmarksRef.current = null;
            setFaceDetected(false);
          }
        } catch (e) {
          // Frame skip
        }
      }

      animationFrameRef.current = requestAnimationFrame(detectLoop);
    };

    animationFrameRef.current = requestAnimationFrame(detectLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cameraActive]);

  // Capture still image and create transparent cutout
  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const landmarks = latestLandmarksRef.current;
    const cutoutUrl = generateCutoutCanvas(canvas, landmarks, stickerStyle, borderColor);

    setCapturedDataUrl(cutoutUrl);
    stopCameraStream();
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const cutoutUrl = generateCutoutCanvas(canvas, null, stickerStyle, borderColor);
          setCapturedDataUrl(cutoutUrl);
          setDetectedExpression("custom");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Generate face cutout or styled badge on canvas
  const generateCutoutCanvas = (
    sourceCanvas: HTMLCanvasElement,
    landmarks: Array<{ x: number; y: number }> | null,
    style: FaceStickerStyle,
    borderCol: string
  ): string => {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    // If landmarks exist, calculate exact face bounds
    let minX = 0,
      maxX = w,
      minY = 0,
      maxY = h;

    if (landmarks && landmarks.length > 0) {
      const xs = landmarks.map((p) => p.x * w);
      const ys = landmarks.map((p) => p.y * h);
      minX = Math.min(...xs);
      maxX = Math.max(...xs);
      minY = Math.min(...ys);
      maxY = Math.max(...ys);

      // Expand bounding box slightly for natural hair/chin
      const padX = (maxX - minX) * 0.25;
      const padY = (maxY - minY) * 0.3;
      minX = Math.max(0, minX - padX);
      maxX = Math.min(w, maxX + padX);
      minY = Math.max(0, minY - padY);
      maxY = Math.min(h, maxY + padY);
    }

    const cropW = Math.max(100, maxX - minX);
    const cropH = Math.max(100, maxY - minY);

    const outCanvas = document.createElement("canvas");
    outCanvas.width = cropW;
    outCanvas.height = cropH;
    const ctx = outCanvas.getContext("2d");
    if (!ctx) return sourceCanvas.toDataURL("image/png");

    ctx.save();

    if (style === "cutout" && landmarks && landmarks.length > 0) {
      // Create path following the face contour landmarks
      ctx.beginPath();
      FACE_CONTOUR_INDICES.forEach((idx, i) => {
        const pt = landmarks[idx];
        const lx = pt.x * w - minX;
        const ly = pt.y * h - minY;
        if (i === 0) ctx.moveTo(lx, ly);
        else ctx.lineTo(lx, ly);
      });
      ctx.closePath();

      // Clip and draw image
      ctx.save();
      ctx.clip();
      ctx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      ctx.restore();

      // Add smooth sticker outline
      ctx.lineWidth = 8;
      ctx.strokeStyle = borderCol;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    } else if (style === "circle" || style === "badge") {
      const radius = Math.min(cropW, cropH) / 2 - 6;
      const cx = cropW / 2;
      const cy = cropH / 2;

      ctx.beginPath();
      if (style === "circle") {
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      } else {
        // Oval badge
        ctx.ellipse(cx, cy, cropW * 0.44, cropH * 0.48, 0, 0, Math.PI * 2);
      }
      ctx.closePath();

      ctx.save();
      ctx.clip();
      ctx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      ctx.restore();

      // Sticker border
      ctx.lineWidth = 8;
      ctx.strokeStyle = borderCol;
      ctx.stroke();
    } else {
      // Rounded photo frame
      const r = 16;
      ctx.beginPath();
      ctx.roundRect(4, 4, cropW - 8, cropH - 8, r);
      ctx.closePath();

      ctx.save();
      ctx.clip();
      ctx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      ctx.restore();

      ctx.lineWidth = 6;
      ctx.strokeStyle = borderCol;
      ctx.stroke();
    }

    ctx.restore();
    return outCanvas.toDataURL("image/png");
  };

  const handleConfirmSticker = () => {
    if (!capturedDataUrl) return;

    onAddSticker({
      src: capturedDataUrl,
      x: 50,
      y: 50,
      scale: 1.0,
      rotation: 0,
      style: stickerStyle,
      borderColor: borderColor,
      borderWidth: 6,
      expressionLabel: detectedExpression,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/70 backdrop-blur-sm animate-fade-in"
      style={{ backgroundColor: "rgba(32, 33, 63, 0.75)" }}
    >
      <div
        className="w-full max-w-lg bg-paper border-2 border-navy rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "#fffef8", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b-2 border-navy/10 bg-cream">
          <div>
            <span className="text-xs uppercase tracking-wider font-bold text-coral">
              ✨ Optional Photo
            </span>
            <h3 className="text-xl font-bold font-fredoka text-navy leading-tight">
              Add Your Expression
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full border-2 border-navy flex items-center justify-center text-lg font-bold hover:bg-coral hover:text-white transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Mode switcher tabs */}
        {!capturedDataUrl && (
          <div className="flex border-b-2 border-navy/10 bg-paper">
            <button
              onClick={() => {
                setActiveTab("camera");
                setErrorMsg("");
              }}
              className={`flex-1 py-3 font-bold text-sm text-center transition-all ${
                activeTab === "camera"
                  ? "bg-paper text-navy border-b-2 border-navy"
                  : "text-navy/60 hover:text-navy"
              }`}
            >
              📷 Live Camera
            </button>
            <button
              onClick={() => {
                stopCameraStream();
                setActiveTab("upload");
                setErrorMsg("");
              }}
              className={`flex-1 py-3 font-bold text-sm text-center transition-all ${
                activeTab === "upload"
                  ? "bg-paper text-navy border-b-2 border-navy"
                  : "text-navy/60 hover:text-navy"
              }`}
            >
              📁 Upload Photo
            </button>
          </div>
        )}

        {/* Modal body */}
        <div className="p-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Captured result preview */}
          {capturedDataUrl ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="text-xs font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                Expression Captured: {detectedExpression.toUpperCase()}
              </span>

              <div
                className="p-4 rounded-2xl border-2 border-dashed border-navy/20 flex items-center justify-center"
                style={{
                  minHeight: "220px",
                  background:
                    "repeating-conic-gradient(#f0ede6 0% 25%, #ffffff 0% 50%) 50% / 20px 20px",
                }}
              >
                <img
                  src={capturedDataUrl}
                  alt="Captured face preview"
                  className="max-h-52 object-contain drop-shadow-lg"
                />
              </div>

              {/* Border color controls */}
              <div className="w-full text-left">
                <label className="text-xs font-bold text-navy/70 block mb-1">
                  Sticker Border Color
                </label>
                <div className="flex gap-2">
                  {["#ffffff", "#ffd83d", "#75c9f5", "#ff765e", "#b991e8", "#20213f"].map(
                    (col) => (
                      <button
                        key={col}
                        onClick={() => setBorderColor(col)}
                        style={{ backgroundColor: col }}
                        className={`w-7 h-7 rounded-full border-2 border-navy shadow-sm transition-transform ${
                          borderColor === col ? "scale-110 ring-2 ring-blue ring-offset-2" : ""
                        }`}
                      />
                    )
                  )}
                </div>
              </div>

              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => {
                    setCapturedDataUrl(null);
                    if (activeTab === "camera") startCamera();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl border-2 border-navy font-bold text-sm hover:bg-navy/5 transition-all"
                >
                  🔄 Retake
                </button>
                <button
                  onClick={handleConfirmSticker}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue text-navy border-2 border-navy font-bold text-sm shadow hover:brightness-105 transition-all"
                  style={{ background: "#75c9f5" }}
                >
                  ✨ Use in Meme
                </button>
              </div>
            </div>
          ) : activeTab === "camera" ? (
            /* Live camera view */
            <div>
              {!cameraActive ? (
                <div className="text-center py-8 px-4 border-2 border-dashed border-navy/20 rounded-2xl bg-cream/50">
                  <span className="text-4xl block mb-2">📸</span>
                  <h4 className="font-bold text-navy text-lg mb-1">
                    Camera is currently off
                  </h4>
                  <p className="text-xs text-navy/70 mb-5 max-w-xs mx-auto">
                    MoodMate values your privacy. Your camera activates only when
                    you click below, and photos are never uploaded to any server.
                  </p>
                  <button
                    onClick={startCamera}
                    disabled={isModelLoading}
                    className="py-3 px-6 rounded-2xl bg-yellow text-navy border-2 border-navy font-bold text-sm shadow-md hover:brightness-105 active:scale-95 transition-all"
                    style={{ background: "#ffd83d" }}
                  >
                    {isModelLoading ? "Loading Face AI…" : "Enable Camera"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden border-2 border-navy bg-black mb-4">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover -scale-x-100"
                    />

                    {/* Face detection target guide */}
                    <div
                      className={`absolute inset-0 pointer-events-none flex items-center justify-center transition-all ${
                        faceDetected ? "opacity-90" : "opacity-40"
                      }`}
                    >
                      <div
                        className={`w-44 h-56 rounded-full border-2 border-dashed transition-colors ${
                          faceDetected ? "border-green-400 bg-green-400/10" : "border-white/70"
                        }`}
                      />
                    </div>

                    <div className="absolute top-3 left-3 bg-navy/80 text-white text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      LIVE
                    </div>

                    <div className="absolute bottom-3 inset-x-0 text-center">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-bold shadow-sm ${
                          faceDetected
                            ? "bg-green-500 text-white"
                            : "bg-navy/80 text-white"
                        }`}
                      >
                        {faceDetected
                          ? "✓ Face detected! Strike a pose"
                          : "Position face in oval"}
                      </span>
                    </div>
                  </div>

                  {/* Cutout style choices */}
                  <div className="flex items-center justify-center gap-2 mb-4 w-full">
                    <span className="text-xs font-bold text-navy/70">Cutout Style:</span>
                    {(
                      [
                        { id: "cutout", label: "Face Cutout" },
                        { id: "circle", label: "Circle" },
                        { id: "frame", label: "Frame" },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        onClick={() => setStickerStyle(st.id)}
                        className={`text-xs py-1 px-2.5 rounded-lg border font-bold ${
                          stickerStyle === st.id
                            ? "bg-navy text-white border-navy"
                            : "bg-white text-navy border-navy/20"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3 w-full">
                    <button
                      onClick={stopCameraStream}
                      className="py-2.5 px-4 rounded-xl border-2 border-navy font-bold text-sm hover:bg-navy/5 transition-all"
                    >
                      Turn Off
                    </button>
                    <button
                      onClick={captureFrame}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-coral text-white border-2 border-navy font-bold text-sm shadow hover:brightness-110 active:scale-95 transition-all"
                      style={{ background: "#ff765e" }}
                    >
                      📸 Snap Expression
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Upload file view */
            <div className="text-center py-8 px-4 border-2 border-dashed border-navy/20 rounded-2xl bg-cream/50">
              <span className="text-4xl block mb-2">📁</span>
              <h4 className="font-bold text-navy text-lg mb-1">
                Choose an image from your device
              </h4>
              <p className="text-xs text-navy/70 mb-5 max-w-xs mx-auto">
                Select any photo (JPG or PNG). MediaPipe will automatically
                isolate your face for the meme.
              </p>

              <label className="inline-block py-3 px-6 rounded-2xl bg-yellow text-navy border-2 border-navy font-bold text-sm shadow-md hover:brightness-105 cursor-pointer active:scale-95 transition-all">
                Select Photo
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-cream/70 border-t border-navy/10 text-center">
          <p className="text-[11px] text-navy/60">
            🔒 100% Client-Side: Photos are never saved on any server or database.
          </p>
        </div>
      </div>
    </div>
  );
}
