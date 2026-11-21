"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  HandLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

export interface FingertipData {
  x: number; // Normalized [0, 1]
  y: number; // Normalized [0, 1]
  z: number;
  handIndex: number;
  landmarkIndex?: number;
  isTip?: boolean;
}

let landmarkerPromise: Promise<HandLandmarker> | null = null;

export function getHandLandmarker(): Promise<HandLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      // 1. Load WebAssembly runtime from local assets
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");

      // 2. Try loading local model asset, fallback to CDN if not available
      try {
        return await HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "/models/hand_landmarker.task",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });
      } catch (localErr) {
        console.warn("Local hand landmarker model failed to load, trying fallback CDN...", localErr);
        return await HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });
      }
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

// Active hand landmarks to track for natural waving/swiping:
// 8: Index tip, 12: Middle tip, 4: Thumb tip, 16: Ring tip, 20: Pinky tip, 9: Middle knuckle (palm center), 0: Wrist
const TRACKED_LANDMARK_INDICES = [8, 12, 4, 16, 20, 9, 0];

export function useHandLandmarker(
  videoRef: RefObject<HTMLVideoElement | null>,
  active: boolean,
  onHandsDetected: (
    fingertips: FingertipData[],
    rawLandmarks: NormalizedLandmark[][],
    dimensions: { width: number; height: number }
  ) => void,
  onError: (message: string) => void
) {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [hasHandDetected, setHasHandDetected] = useState(false);

  const onHandsRef = useRef(onHandsDetected);
  const onErrorRef = useRef(onError);
  onHandsRef.current = onHandsDetected;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active) {
      setHasHandDetected(false);
      return;
    }

    let isStopped = false;
    let animationFrameId = 0;
    let lastTimestamp = 0;
    let lastProcessTime = 0;
    let lastPresenceState = false;

    setIsModelLoading(true);

    getHandLandmarker()
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
            // Process at ~40fps for optimal responsiveness without frame drops
            if (currentRafTime - lastProcessTime >= 24) {
              lastProcessTime = currentRafTime;

              try {
                // Ensure strictly monotonic timestamp for MediaPipe Tasks
                const frameTimestamp = Math.max(performance.now(), lastTimestamp + 1);
                lastTimestamp = frameTimestamp;

                const result = landmarker.detectForVideo(video, frameTimestamp);
                const detectedHands = result.landmarks || [];
                const points: FingertipData[] = [];

                for (let i = 0; i < detectedHands.length; i++) {
                  const hand = detectedHands[i];
                  for (const lmIdx of TRACKED_LANDMARK_INDICES) {
                    const lm = hand[lmIdx];
                    if (lm) {
                      points.push({
                        x: lm.x,
                        y: lm.y,
                        z: lm.z,
                        handIndex: i,
                        landmarkIndex: lmIdx,
                        isTip: lmIdx === 8 || lmIdx === 12,
                      });
                    }
                  }
                }

                const hasHands = points.length > 0;
                if (hasHands !== lastPresenceState) {
                  lastPresenceState = hasHands;
                  setHasHandDetected(hasHands);
                }

                onHandsRef.current(
                  points,
                  detectedHands,
                  { width: video.videoWidth, height: video.videoHeight }
                );
              } catch (err) {
                // Transient frame glitches
              }
            }
          }

          animationFrameId = requestAnimationFrame(detectFrame);
        };

        animationFrameId = requestAnimationFrame(detectFrame);
      })
      .catch((err) => {
        if (isStopped) return;
        setIsModelLoading(false);
        console.error("HandLandmarker initialization failed:", err);
        onErrorRef.current(
          "Could not initialize hand tracking. Please check your camera connection."
        );
      });

    return () => {
      isStopped = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      setHasHandDetected(false);
    };
  }, [active, videoRef]);

  return {
    isModelLoading,
    isModelReady,
    hasHandDetected,
  };
}
