export type SupportedMood =
  | "Sad"
  | "Overwhelmed"
  | "Happy"
  | "Neutral"
  | "Lazy"
  | "Angry";

export interface RecommendedActivity {
  id: "meme" | "air-painter" | "move-match" | "bubble-burst";
  title: string;
  category: string;
  duration: string;
  description: string;
  color: string;
  art: string;
}

// Centralized mood-to-activity recommendation mapping
// Exactly as specified:
// Sad -> Meme Recreation
// Overwhelmed -> Meme Recreation
// Happy -> Air Painter
// Neutral -> Move & Match
// Lazy -> Move & Match
// Angry -> Bubble Burst
export const MOOD_ACTIVITY_MAPPING: Record<SupportedMood, RecommendedActivity> = {
  Sad: {
    id: "meme",
    title: "Meme Recreation",
    category: "Camera Challenge",
    duration: "3 min",
    description: "Turn that low mood upside down by recreating iconic memes.",
    color: "#FFB0E0",
    art: "camera",
  },
  Overwhelmed: {
    id: "meme",
    title: "Meme Recreation",
    category: "Camera Challenge",
    duration: "3 min",
    description: "Take a break from everything and laugh through silly meme recreations.",
    color: "#B991E8",
    art: "camera",
  },
  Happy: {
    id: "air-painter",
    title: "Air Painter",
    category: "Creative Flow",
    duration: "4 min",
    description: "Channel your positive energy into freeform glowing neon artwork.",
    color: "#FFD83D",
    art: "draw",
  },
  Neutral: {
    id: "move-match",
    title: "Move & Match",
    category: "Physical Reset",
    duration: "3 min",
    description: "Quick, fun movement resets to bring energy, focus, and alignment.",
    color: "#A8E6C3",
    art: "move",
  },
  Lazy: {
    id: "move-match",
    title: "Move & Match",
    category: "Physical Reset",
    duration: "3 min",
    description: "Shake off sluggishness with gentle, feel-good guided movements.",
    color: "#75C9F5",
    art: "move",
  },
  Angry: {
    id: "bubble-burst",
    title: "Bubble Burst",
    category: "Stress Release",
    duration: "2 min",
    description: "Pop the pressure away with satisfying, explosive stress bubbles.",
    color: "#FF765E",
    art: "focus",
  },
};

/**
 * Returns the recommended activity for any mood string (case-insensitive).
 * Defaults to Meme Recreation if unknown.
 */
export function getRecommendedActivity(mood: string): RecommendedActivity {
  const normalized = mood?.trim().toLowerCase() || "";
  for (const [key, activity] of Object.entries(MOOD_ACTIVITY_MAPPING)) {
    if (key.toLowerCase() === normalized) {
      return activity;
    }
  }

  // Fallbacks for related keywords
  if (normalized.includes("sad") || normalized.includes("cloudy")) {
    return MOOD_ACTIVITY_MAPPING.Sad;
  }
  if (normalized.includes("overwhelm") || normalized.includes("wiggles")) {
    return MOOD_ACTIVITY_MAPPING.Overwhelmed;
  }
  if (normalized.includes("happy") || normalized.includes("sunny")) {
    return MOOD_ACTIVITY_MAPPING.Happy;
  }
  if (normalized.includes("lazy") || normalized.includes("tired")) {
    return MOOD_ACTIVITY_MAPPING.Lazy;
  }
  if (normalized.includes("angry") || normalized.includes("spark") || normalized.includes("frustrat")) {
    return MOOD_ACTIVITY_MAPPING.Angry;
  }

  return MOOD_ACTIVITY_MAPPING.Neutral;
}
