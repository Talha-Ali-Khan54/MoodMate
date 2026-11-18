"use client";
import { useRef, useState, useEffect, type RefObject } from "react";
import { useFaceFeatures } from "./useFaceFeatures";
import { predictExpression } from "@/lib/api";
import type { Expression } from "@/lib/mood";

const SAMPLES = 12; // frames averaged before one prediction
type State = { phase: "waiting" | "analyzing" | "prediction" | "error"; label: Expression | null; source: "model" | "rule" | null; error: string };
const initial: State = { phase: "waiting", label: null, source: null, error: "" };

export function useExpression(video: RefObject<HTMLVideoElement | null>, running: boolean) {
  const [state, setState] = useState<State>(initial);
  const buf = useRef<number[][]>([]);
  const busy = useRef(false);

  useEffect(() => {
    if (running) { buf.current = []; busy.current = false; setState(initial); }
  }, [running]);

  useFaceFeatures(
    video,
    running,
    (f) => {
      if (busy.current) return;
      if (!f) { buf.current = []; setState((s) => (s.phase === "waiting" ? s : initial)); return; }
      buf.current.push(f);
      setState((s) => (s.phase === "analyzing" ? s : { ...initial, phase: "analyzing" }));
      if (buf.current.length < SAMPLES) return;
      busy.current = true;
      const mean = buf.current[0].map((_, i) => buf.current.reduce((a, r) => a + r[i], 0) / buf.current.length);
      predictExpression(mean).then((r) => setState({ phase: "prediction", label: r.label, source: r.source, error: "" }));
    },
    (error) => setState({ ...initial, phase: "error", error }),
  );
  return state;
}
