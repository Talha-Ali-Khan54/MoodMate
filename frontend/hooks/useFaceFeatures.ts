"use client";

import { useEffect, useRef, type RefObject } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { buildFeatures } from "@/lib/features";

let loading: Promise<FaceLandmarker> | null = null;

function getLandmarker() {
  loading ??= FilesetResolver.forVisionTasks("/mediapipe/wasm")
    .then((fileset) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/models/face_landmarker.task",
        },
        runningMode: "VIDEO",
        numFaces: 1,
      }),
    )
    .catch((e) => {
      loading = null;
      throw e;
    });

  return loading;
}

export function useFaceFeatures(
  video: RefObject<HTMLVideoElement | null>,
  active: boolean,
  onFrame: (features: number[] | null) => void,
  onError: (message: string) => void,
) {
  const frame = useRef(onFrame);
  const fail = useRef(onError);

  frame.current = onFrame;
  fail.current = onError;

  useEffect(() => {
    if (!active) return;

    let stopped = false;
    let raf = 0;
    let last = 0;

    getLandmarker()
      .then((lm) => {
        // Prevent running if stopped while landmarker was loading
        if (stopped) return;

        const tick = (t: number) => {
          if (stopped) return;

          const v = video.current;

          // Process video frames when the video is ready and throttled (~100ms)
          if (v && v.readyState >= 2 && t - last > 100) {
            last = t;

            try {
              const result = lm.detectForVideo(v, t);
              const face = result?.faceLandmarks?.[0];

              if (face) {
                const features = buildFeatures(face);
                frame.current(features);
              } else {
                frame.current(null);
              }
            } catch (err) {
              // Ignore occasional frame capture errors
            }
          }

          raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
      })
      .catch((error) => {
        if (stopped) return;
        console.error("MediaPipe initialization failed:", error);
        fail.current(
          "The face model could not load. Choose how you feel instead."
        );
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [active, video]);
}
