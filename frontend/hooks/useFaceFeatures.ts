"use client";
import { useEffect, useRef, type RefObject } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { buildFeatures } from "@/lib/features";

let loading: Promise<FaceLandmarker> | null = null;
function getLandmarker() {
  loading ??= FilesetResolver.forVisionTasks("/mediapipe/wasm")
    .then((fileset) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/models/face_landmarker.task" }, // bundled locally: works offline
        runningMode: "VIDEO",
        numFaces: 1,
      }),
    )
    .catch((e) => { loading = null; throw e; });
  return loading;
}

/** Calls onFrame(features) ~8x/second while active; null when no face is visible. Reusable by every webcam activity. */
export function useFaceFeatures(
  video: RefObject<HTMLVideoElement | null>,
  active: boolean,
  onFrame: (features: number[] | null) => void,
  onError: (message: string) => void,
) {
  const frame = useRef(onFrame), fail = useRef(onError);
  frame.current = onFrame;
  fail.current = onError;

  useEffect(() => {
    if (!active) return;
    let stopped = false, raf = 0, last = 0;
    getLandmarker()
      .then((lm) => {
        const tick = (t: number) => {
          if (stopped) return;
          const v = video.current;
          if (v && v.readyState >= 2 && t - last > 120) {
            last = t;
            const face = lm.detectForVideo(v, t).faceLandmarks[0];
            frame.current(face ? buildFeatures(face) : null);
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => fail.current("The face model could not load. Choose how you feel instead."));
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }, [active, video]);
}
