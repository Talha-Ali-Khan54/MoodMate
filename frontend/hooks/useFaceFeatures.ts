
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
    console.log("useFaceFeatures effect running. Active:", active);

    if (!active) return;

    let stopped = false;
    let raf = 0;
    let last = 0;
    let loggedVideo = false;

    getLandmarker()
      .then((lm) => {
        console.log("Landmarker loaded successfully");

        const tick = (t: number) => {
          if (stopped) return;

          const v = video.current;

          // Log video information once
          if (!loggedVideo) {
            console.log("Video element:", v);
            console.log("Video readyState:", v?.readyState);
            console.log(
              "Video dimensions:",
              v?.videoWidth,
              v?.videoHeight
            );

            loggedVideo = true;
          }

          // Process video frames when the video is ready
          if (v && v.readyState >= 2 && t - last > 120) {
            last = t;

            const result = lm.detectForVideo(v, t);
            const face = result.faceLandmarks[0];

            console.log("Face detected:", !!face);

            if (face) {
              const features = buildFeatures(face);

              console.log("Extracted features:", features);

              frame.current(features);
            } else {
              frame.current(null);
            }
          }

          raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
      })
      .catch((error) => {
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
