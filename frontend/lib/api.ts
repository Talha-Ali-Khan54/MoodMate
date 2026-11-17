import type { Expression } from "./mood";
import { EXPRESSIONS } from "./mood";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Baseline from the proposal: simple threshold rule on mouth features.
// Thresholds are rough placeholders: tune them on features.csv.
export function ruleBaseline(f: number[]): Expression {
  const [, opening, , , lipL, lipR] = f;
  const lip = (lipL + lipR) / 2;
  if (opening > 0.22) return "surprised";
  if (lip > 0.035) return "smiling";
  if (lip < -0.005) return "frowning";
  return "neutral";
}

/** Sends ONLY the feature vector (no images). Falls back to the rule baseline when the API is down. */
export async function predictExpression(features: number[]): Promise<{ label: Expression; source: "model" | "rule" }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(`${API}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    const { label } = await res.json();
    if (!EXPRESSIONS.includes(label)) throw new Error("bad label");
    return { label, source: "model" };
  } catch {
    return { label: ruleBaseline(features), source: "rule" };
  } finally {
    clearTimeout(timer);
  }
}
