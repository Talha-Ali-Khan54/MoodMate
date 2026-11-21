"use client";

import { useRef, useState, useEffect, useCallback, type RefObject } from "react";
import { useFaceFeatures } from "./useFaceFeatures";
import { predictExpression } from "@/lib/api";
import {
  interpretFrontendMood,
  type FrontendMood,
  type BackendPredictionResult,
  type HybridMoodResult,
} from "@/lib/mood";

const SAMPLES = 10; // Frames averaged before producing a prediction

export type ExpressionPhase = "idle" | "waiting" | "analyzing" | "prediction" | "error";

export interface ExpressionState {
  phase: ExpressionPhase;
  frontendMood: FrontendMood | null;
  backendPrediction: BackendPredictionResult | null;
  features: number[] | null;
  error: string;
}

const initial: ExpressionState = {
  phase: "idle",
  frontendMood: null,
  backendPrediction: null,
  features: null,
  error: "",
};

export function useExpression(
  video: RefObject<HTMLVideoElement | null>,
  running: boolean
) {
  const [state, setState] = useState<ExpressionState>(initial);
  const buf = useRef<number[][]>([]);
  const busy = useRef(false);
  const runningRef = useRef(running);
  runningRef.current = running;

  const reset = useCallback(() => {
    buf.current = [];
    busy.current = false;
    setState(runningRef.current ? { ...initial, phase: "waiting" } : initial);
  }, []);

  useEffect(() => {
    if (running) {
      buf.current = [];
      busy.current = false;
      setState({ ...initial, phase: "waiting" });
    } else {
      buf.current = [];
      busy.current = false;
      setState(initial);
    }
  }, [running]);

  useFaceFeatures(
    video,
    running,
    (f) => {
      if (!runningRef.current || busy.current) return;

      if (!f) {
        // No face in current frame
        buf.current = [];
        setState((s) => (s.phase === "waiting" ? s : { ...initial, phase: "waiting" }));
        return;
      }

      buf.current.push(f);
      setState((s) => (s.phase === "analyzing" ? s : { ...initial, phase: "analyzing" }));

      if (buf.current.length < SAMPLES) return;

      busy.current = true;
      const currentBuf = buf.current;
      const meanFeatures = currentBuf[0].map(
        (_, i) => currentBuf.reduce((sum, row) => sum + row[i], 0) / currentBuf.length
      );

      // 1. Synchronously interpret frontend MediaPipe mood (supports 7 moods)
      const frontendMood = interpretFrontendMood(meanFeatures);

      // 2. Concurrently query backend Random Forest model (FastAPI 4-class)
      predictExpression(meanFeatures)
        .then((backendRes) => {
          if (!runningRef.current) return;
          setState({
            phase: "prediction",
            frontendMood,
            backendPrediction: backendRes,
            features: meanFeatures,
            error: "",
          });
        })
        .catch((err) => {
          if (!runningRef.current) return;
          setState({
            phase: "prediction",
            frontendMood,
            backendPrediction: {
              label: null,
              status: "unavailable",
              errorMsg: err?.message || "Prediction error",
            },
            features: meanFeatures,
            error: "",
          });
        });
    },
    (errorMsg) => {
      if (!runningRef.current) return;
      setState({ ...initial, phase: "error", error: errorMsg });
    }
  );

  return { ...state, reset };
}
