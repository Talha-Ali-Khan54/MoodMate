export const EXPRESSIONS = ["happy", "sad", "angry", "neutral"] as const;

export type Expression = (typeof EXPRESSIONS)[number];

export type MoodKey = "sunny" | "cloudy" | "spark" | "wiggles";

// The model predicts a visible facial expression.
// The user confirms their actual mood afterwards.
export const EXPRESSION_TO_MOOD: Record<Expression, MoodKey> = {
  happy: "sunny",
  sad: "cloudy",
  angry: "spark",
  neutral: "wiggles",
};