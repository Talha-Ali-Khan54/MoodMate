"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";

// MediaPipe logs this harmless INFO line via console.error, which triggers Next's dev overlay.
if (typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("XNNPACK delegate")) return;
    originalError(...args);
  };
}

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

export function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");

      try {
        return await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "/models/pose_landmarker.task",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (localErr) {
        console.warn(
          "Local pose landmarker failed, trying CDN fallback...",
          localErr
        );
        return await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

export function usePoseLandmarker(
  videoRef: RefObject<HTMLVideoElement | null>,
  active: boolean,
  onPoseDetected: (
    landmarks: NormalizedLandmark[][],
    dimensions: { width: number; height: number }
  ) => void,
  onError: (message: string) => void
) {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [hasPoseDetected, setHasPoseDetected] = useState(false);

  const onPoseRef = useRef(onPoseDetected);
  const onErrorRef = useRef(onError);
  onPoseRef.current = onPoseDetected;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active) {
      setHasPoseDetected(false);
      return;
    }

    let isStopped = false;
    let animationFrameId = 0;
    let lastVideoTime = -1;
    let lastPresenceState = false;

    setIsModelLoading(true);

    getPoseLandmarker()
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
            if (currentTime !== lastVideoTime) {
              lastVideoTime = currentTime;

              try {
                const result = landmarker.detectForVideo(
                  video,
                  performance.now()
                );
                const detectedPoses = result.landmarks || [];
                const hasPoses = detectedPoses.length > 0;

                if (hasPoses !== lastPresenceState) {
                  lastPresenceState = hasPoses;
                  setHasPoseDetected(hasPoses);
                }

                onPoseRef.current(detectedPoses, {
                  width: video.videoWidth,
                  height: video.videoHeight,
                });
              } catch {
                // Ignore transient frame glitches
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
        console.error("PoseLandmarker initialization failed:", err);
        onErrorRef.current(
          "Could not initialize pose tracking. Please check your camera."
        );
      });

    return () => {
      isStopped = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      setHasPoseDetected(false);
    };
  }, [active, videoRef]);

  return {
    isModelLoading,
    isModelReady,
    hasPoseDetected,
  };
}