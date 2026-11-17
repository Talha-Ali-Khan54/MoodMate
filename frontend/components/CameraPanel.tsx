"use client";
import { useEffect, useRef, useState } from "react";
import { useExpression } from "@/hooks/useExpression";
import { EXPRESSION_TO_MOOD } from "@/lib/mood";

export function CameraPanel({
  onPrediction,
  onError,
}: {
  onPrediction: (mood: any) => void;
  onError: (msg: string) => void;
}) {
  const [cameraState, setCameraState] = useState<
    "idle" | "requesting" | "waiting" | "analyzing" | "prediction" | "error"
  >("idle");
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const expr = useExpression(videoRef, cameraState === "waiting" || cameraState === "analyzing");
  const prediction = EXPRESSION_TO_MOOD[expr.label ?? "neutral"];

  async function enableCamera() {
    setCameraState("requesting");
    setCameraError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setCameraState("waiting");
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setCameraError("We couldn’t open your camera. Check your browser permission, or choose manually.");
      setCameraState("error");
      onError("Camera access denied.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraState("idle");
  }

  useEffect(() => {
    if (cameraState !== "waiting" && cameraState !== "analyzing") return;
    if (expr.phase === "error") {
      stopCamera();
      setCameraError(expr.error);
      setCameraState("error");
      onError(expr.error);
    } else if (expr.phase === "analyzing" || (expr.phase === "prediction" && cameraState === "analyzing")) {
      setCameraState(expr.phase);
    } else if (expr.phase === "waiting" && cameraState === "analyzing") {
      setCameraState("waiting");
    }
    
    if (expr.phase === "prediction") {
      onPrediction(prediction);
      stopCamera(); // Stop camera once we get a prediction to save resources
    }
  }, [expr.phase, expr.error, cameraState, prediction, onPrediction]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const cameraActive = ["waiting", "analyzing", "prediction"].includes(cameraState);

  return (
    <div className={`ai-camera ${cameraActive ? "is-live" : ""}`}>
      <div className="camera-corner top-left" />
      <div className="camera-corner top-right" />
      <div className="camera-corner bottom-left" />
      <div className="camera-corner bottom-right" />

      {cameraActive ? (
        <>
          <video ref={videoRef} autoPlay muted playsInline />
          <div className="live-badge"><i /> LIVE</div>
          <button className="camera-close" onClick={stopCamera}><span>×</span></button>
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
            <span className="status-pulse"><i /><i /><i /></span>
            <div>
              <b>{cameraState === "waiting" ? "Looking for you…" : "Analyzing expression…"}</b>
              <small>Please hold still.</small>
            </div>
          </div>
        </>
      ) : (
        <div className="camera-empty">
          {cameraState === "requesting" ? (
            <>
              <div className="permission-loader"><i /><i /><i /></div>
              <h2>Asking for camera access…</h2>
            </>
          ) : cameraState === "error" ? (
            <>
              <span className="camera-empty-icon error">📷</span>
              <h2>Camera’s feeling shy.</h2>
              <p>{cameraError}</p>
              <button className="primary" onClick={enableCamera}>Try again</button>
            </>
          ) : (
            <>
              <span className="camera-empty-icon">📷</span>
              <h2>Your check-in starts here.</h2>
              <p>Nothing starts until you say so.</p>
              <button className="primary camera-start" onClick={enableCamera}>Enable camera</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}