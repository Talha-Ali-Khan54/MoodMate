"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useExpression } from "@/hooks/useExpression";
import type { HybridMoodResult } from "@/lib/mood";

export function CameraPanel({
  onPrediction,
  onError,
}: {
  onPrediction: (result: HybridMoodResult) => void;
  onError: (msg: string) => void;
}) {
  const [cameraState, setCameraState] = useState<
    "idle" | "requesting" | "waiting" | "analyzing" | "prediction" | "error"
  >("idle");

  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef(0);
  const predictionHandledRef = useRef(false);

  const isLive = cameraState === "waiting" || cameraState === "analyzing";
  const expr = useExpression(videoRef, isLive);

  // Stop camera and cleanly release all hardware tracks
  const stopCamera = useCallback(() => {
    sessionIdRef.current += 1;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch (e) {
        // ignore
      }
    }

    expr.reset();
    setCameraState("idle");
  }, [expr]);

  // Request camera access - works on FIRST click every time
  async function enableCamera() {
    const session = ++sessionIdRef.current;
    predictionHandledRef.current = false;
    setCameraError("");
    setCameraState("requesting");
    expr.reset();

    // Release any lingering prior tracks if any existed
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera is unavailable on this device.");
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
      setCameraState("waiting");
    } catch (error: any) {
      if (sessionIdRef.current !== session) return;

      console.error("Camera access error:", error);
      const isDenied =
        error?.name === "NotAllowedError" ||
        error?.name === "PermissionDeniedError";

      const msg = isDenied
        ? "Camera permission was denied. Please allow camera access in your browser settings, or select your mood manually."
        : "We couldn’t open your camera. Please check your webcam and try again.";

      setCameraError(msg);
      setCameraState("error");
      onError(msg);
    }
  }

  // Ref callback to immediately bind stream and start playback as soon as video DOM node mounts
  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current && node.srcObject !== streamRef.current) {
      node.srcObject = streamRef.current;
      node
        .play()
        .then(() => {
          console.log("Camera video stream playing smoothly.");
        })
        .catch((err: any) => {
          if (err?.name === "AbortError") {
            // Normal when playback is interrupted or re-rendered
            return;
          }
          console.warn("Video playback notice:", err);
        });
    }
  }, []);

  // Synchronize internal expression phase with camera state
  useEffect(() => {
    if (cameraState !== "waiting" && cameraState !== "analyzing") {
      return;
    }

    if (expr.phase === "error") {
      stopCamera();
      setCameraError(expr.error);
      setCameraState("error");
      onError(expr.error);
      return;
    }

    if (expr.phase === "analyzing" && cameraState === "waiting") {
      setCameraState("analyzing");
    }

    if (expr.phase === "waiting" && cameraState === "analyzing") {
      setCameraState("waiting");
    }

    if (
      expr.phase === "prediction" &&
      expr.frontendMood &&
      expr.backendPrediction &&
      expr.features &&
      !predictionHandledRef.current
    ) {
      predictionHandledRef.current = true;

      onPrediction({
        frontendMood: expr.frontendMood,
        backendPrediction: expr.backendPrediction,
        features: expr.features,
      });

      stopCamera();
    }
  }, [
    expr.phase,
    expr.error,
    expr.frontendMood,
    expr.backendPrediction,
    expr.features,
    cameraState,
    onPrediction,
    stopCamera,
    onError,
  ]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      sessionIdRef.current += 1;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const cameraActive = ["waiting", "analyzing", "prediction"].includes(cameraState);

  return (
    <div className={`ai-camera ${cameraActive ? "is-live" : ""}`}>
      <div className="camera-corner top-left" />
      <div className="camera-corner top-right" />
      <div className="camera-corner bottom-left" />
      <div className="camera-corner bottom-right" />

      {cameraActive ? (
        <>
          <video
            ref={handleVideoRef}
            autoPlay
            muted
            playsInline
          />

          <div className="live-badge">
            <i /> LIVE
          </div>

          <button className="camera-close" onClick={stopCamera} title="Close camera">
            <span>×</span>
          </button>

          {(cameraState === "analyzing" || cameraState === "prediction") && (
            <div className="face-map" aria-hidden="true">
              <div className="face-oval" />
              <svg viewBox="0 0 100 100">
                <path d="M34 42 Q39 38 44 42 M56 42 Q61 38 66 42 M39 67 Q50 76 61 67" />
              </svg>
            </div>
          )}

          {cameraState === "waiting" && <div className="scan-line" />}

          <div className={`camera-status status-${cameraState}`}>
            <span className="status-pulse">
              <i />
              <i />
              <i />
            </span>

            <div>
              <b>
                {cameraState === "waiting"
                  ? "Looking for you…"
                  : "Analyzing expression…"}
              </b>
              <small>MediaPipe landmarks + Random Forest check</small>
            </div>
          </div>
        </>
      ) : (
        <div className="camera-empty">
          {cameraState === "requesting" ? (
            <>
              <div className="permission-loader">
                <i />
                <i />
                <i />
              </div>
              <h2>Asking for camera access…</h2>
            </>
          ) : cameraState === "error" ? (
            <>
              <span className="camera-empty-icon error">📷</span>
              <h2>Camera’s feeling shy.</h2>
              <p>{cameraError}</p>
              <button className="primary" onClick={enableCamera}>
                Try again
              </button>
            </>
          ) : (
            <>
              <span className="camera-empty-icon">📷</span>
              <h2>Your check-in starts here.</h2>
              <p>Nothing starts until you say so.</p>
              <button
                className="primary camera-start"
                onClick={enableCamera}
              >
                Enable camera
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
