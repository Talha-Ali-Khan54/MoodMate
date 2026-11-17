export const EXPRESSIONS = ["smiling", "neutral", "frowning", "surprised"] as const;
export type Expression = (typeof EXPRESSIONS)[number];
export type MoodKey = "sunny" | "cloudy" | "spark" | "wiggles";

// The model only sees an expression; the user confirms the real mood afterwards.
// "neutral" has no matching character in the design yet: open question for the team.
export const EXPRESSION_TO_MOOD: Record<Expression, MoodKey> = {
  smiling: "sunny",
  frowning: "cloudy",
  surprised: "wiggles",
  neutral: "cloudy",
};
