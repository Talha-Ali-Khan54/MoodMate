"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      return await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/models/face_landmarker.task",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.35,
        minFacePresenceConfidence: 0.35,
      });
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

export function useHeadTracker(
  videoRef: RefObject<HTMLVideoElement | null>,
  active: boolean,
  onHeadMoved?: (normalizedX: number, hasFace: boolean) => void,
  onError?: (msg: string) => void
) {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [hasFaceDetected, setHasFaceDetected] = useState(false);

  const headXRef = useRef(0.5); // Smoothed normalized head position [0, 1]
  const targetXRef = useRef(0.5);
  const onHeadRef = useRef(onHeadMoved);
  const onErrorRef = useRef(onError);
  onHeadRef.current = onHeadMoved;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active) {
      setHasFaceDetected(false);
      return;
    }

    let isStopped = false;
    let animationFrameId = 0;
    let lastTimestamp = 0;
    let lastProcessTime = 0;
    let lastFaceSeenTime = performance.now();
    let currentSmoothX = headXRef.current;

    setIsModelLoading(true);

    getFaceLandmarker()
      .then((landmarker) => {
        if (isStopped) return;
        setIsModelLoading(false);
        setIsModelReady(true);

        const detectFrame = (currentRafTime: number) => {
          if (isStopped) return;

          const video = videoRef.current;
          if (
            video &&
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
          ) {
            // Process at ~45fps for responsive head tracking
            if (currentRafTime - lastProcessTime >= 22) {
              lastProcessTime = currentRafTime;

              try {
                // Ensure strictly monotonic timestamp
                const frameTimestamp = Math.max(performance.now(), lastTimestamp + 1);
                lastTimestamp = frameTimestamp;

                const result = landmarker.detectForVideo(video, frameTimestamp);
                const landmarks = result?.faceLandmarks?.[0];

                if (landmarks && landmarks.length > 1) {
                  lastFaceSeenTime = performance.now();

                  // Landmark 1 is the nose tip, landmarks 234 and 454 are left/right cheek contours
                  const noseX = landmarks[1]?.x ?? 0.5;
                  const cheekLeft = landmarks[234]?.x ?? 0.4;
                  const cheekRight = landmarks[454]?.x ?? 0.6;
                  const faceCenterX = (cheekLeft + cheekRight) / 2;

                  // Combined weighted center of head position
                  const combinedX = noseX * 0.7 + faceCenterX * 0.3;

                  // Mirror horizontally for intuitive selfie perspective
                  const mirroredX = 1 - combinedX;

                  // Map natural head movement range [0.33, 0.67] to [0.05, 0.95]
                  const minBound = 0.33;
                  const maxBound = 0.67;
                  const clamped = Math.max(minBound, Math.min(maxBound, mirroredX));
                  const targetX = (clamped - minBound) / (maxBound - minBound);

                  targetXRef.current = targetX;
                  setHasFaceDetected(true);
                } else if (performance.now() - lastFaceSeenTime > 900) {
                  setHasFaceDetected(false);
                }
              } catch (err) {
                // Transient frame glitches
              }
            }
          }

          // Smooth character movement using Exponential Moving Average (EMA)
          currentSmoothX = currentSmoothX * 0.78 + targetXRef.current * 0.22;
          headXRef.current = currentSmoothX;

          onHeadRef.current?.(currentSmoothX, hasFaceDetected);

          animationFrameId = requestAnimationFrame(detectFrame);
        };

        animationFrameId = requestAnimationFrame(detectFrame);
      })
      .catch((err) => {
        if (isStopped) return;
        setIsModelLoading(false);
        console.error("FaceLandmarker initialization failed:", err);
        onErrorRef.current?.(
          "Could not initialize face tracking. Please check your webcam."
        );
      });

    return () => {
      isStopped = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      setHasFaceDetected(false);
    };
  }, [active, videoRef]);

  return {
    isModelLoading,
    isModelReady,
    hasFaceDetected,
    headXRef,
  };
}
