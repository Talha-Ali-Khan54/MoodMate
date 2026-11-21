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
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
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
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
        });
      }
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

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
    let lastVideoTime = -1;
    let lastPresenceState = false;

    setIsModelLoading(true);

    getHandLandmarker()
      .then((landmarker) => {
        if (isStopped) return;
        setIsModelLoading(false);
        setIsModelReady(true);

        const detectFrame = () => {
          if (isStopped) return;

          const video = videoRef.current;
          if (
            video &&
            video.readyState >= 2 &&
            !video.paused &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
          ) {
            const currentTime = video.currentTime;
            // Only process when video frame has advanced
            if (currentTime !== lastVideoTime) {
              lastVideoTime = currentTime;

              try {
                // Ensure strictly monotonic timestamp for MediaPipe
                const frameTimestamp = performance.now();
                const result = landmarker.detectForVideo(video, frameTimestamp);

                const detectedHands = result.landmarks || [];
                const fingertips: FingertipData[] = [];

                for (let i = 0; i < detectedHands.length; i++) {
                  const hand = detectedHands[i];
                  // Index fingertip is landmark 8
                  const tip = hand[8];
                  if (tip) {
                    fingertips.push({
                      x: tip.x,
                      y: tip.y,
                      z: tip.z,
                      handIndex: i,
                    });
                  }
                }

                const hasHands = fingertips.length > 0;
                if (hasHands !== lastPresenceState) {
                  lastPresenceState = hasHands;
                  setHasHandDetected(hasHands);
                }

                onHandsRef.current(
                  fingertips,
                  detectedHands,
                  { width: video.videoWidth, height: video.videoHeight }
                );
              } catch (err) {
                // Ignore transient frame detection glitches
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
