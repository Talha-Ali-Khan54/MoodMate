
import type { Expression } from "./mood";
import { EXPRESSIONS } from "./mood";

const API =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Temporary fallback if the backend is unavailable.
// This is not a replacement for the trained ML model.
export function ruleBaseline(features: number[]): Expression {
  const cornerLift = features[6];

  if (cornerLift > 0.035) return "happy";
  if (cornerLift < -0.005) return "sad";

  return "neutral";
}

export async function predictExpression(
  features: number[]
): Promise<{
  label: Expression;
  source: "model" | "rule";
}> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);

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
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();

    if (!EXPRESSIONS.includes(data.label)) {
      throw new Error("Invalid expression returned by API");
    }

    return {
      label: data.label,
      source: "model",
    };
  } catch (error) {
    console.error("Prediction API failed:", error);

    return {
      label: ruleBaseline(features),
      source: "rule",
    };
  } finally {
    clearTimeout(timer);
  }
}
