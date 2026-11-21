import type { BackendExpression, BackendPredictionResult } from "./mood";
import { EXPRESSIONS } from "./mood";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Baseline rule-based expression estimate for local client utility.
 */
export function ruleBaseline(features: number[]): BackendExpression {
  if (!features || features.length < 7) return "neutral";
  const cornerLift = features[6];
  if (cornerLift > 0.035) return "happy";
  if (cornerLift < -0.005) return "sad";
  return "neutral";
}

/**
 * Predicts the facial expression using the trained Random Forest model on the FastAPI backend.
 * Exactly sends 7 facial features extracted from MediaPipe:
 * [mouth_width, mouth_opening, left_eye_opening, right_eye_opening, left_brow_eye, right_brow_eye, corner_lift]
 *
 * If the backend is unavailable or encounters an error, returns status: "unavailable"
 * without masquerading a frontend fallback as a Random Forest prediction.
 */
export async function predictExpression(
  features: number[]
): Promise<BackendPredictionResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);

  try {
    const res = await fetch(`${API}/api/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ features }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }

    const data = await res.json();

    if (!EXPRESSIONS.includes(data.label)) {
      throw new Error("Invalid expression returned by Random Forest backend");
    }

    return {
      label: data.label as BackendExpression,
      status: "success",
    };
  } catch (error: any) {
    console.warn("Backend Random Forest prediction unavailable:", error?.message || error);
    return {
      label: null,
      status: "unavailable",
      errorMsg: error?.name === "AbortError" ? "Backend connection timed out" : "FastAPI server unreachable",
    };
  } finally {
    clearTimeout(timer);
  }
}
