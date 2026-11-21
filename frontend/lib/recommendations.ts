export type SupportedMood =
  | "Sad"
  | "Overwhelmed"
  | "Happy"
  | "Neutral"
  | "Lazy"
  | "Angry"
  | "Frustrated";

export interface RecommendedActivity {
  id: "meme" | "air-painter" | "move-match" | "bubble-burst" | "cloud-catcher";
  title: string;
  category: string;
  duration: string;
  description: string;
  color: string;
  art: string;
}

// Centralized mood-to-activity recommendation mapping
// Sad -> Cloud Catcher
// Overwhelmed -> Cloud Catcher
// Happy -> Meme Recreation
// Neutral -> Move & Match
// Lazy -> Move & Match
// Angry -> Bubble Burst
// Frustrated -> Bubble Burst
export const MOOD_ACTIVITY_MAPPING: Record<SupportedMood, RecommendedActivity> = {
  Sad: {
    id: "cloud-catcher",
    title: "Cloud Catcher",
    category: "Relaxing Journey",
    duration: "2 min",
    description: "Catch gentle stars with head movements to transform a gloomy sky into bright sunshine.",
    color: "#75C9F5",
    art: "cloud",
  },
  Overwhelmed: {
    id: "cloud-catcher",
    title: "Cloud Catcher",
    category: "Relaxing Journey",
    duration: "2 min",
    description: "Take a calming pause, collect comforting stars, and let the storm clouds roll away.",
    color: "#B991E8",
    art: "cloud",
  },
  Happy: {
    id: "meme",
    title: "Meme Recreation",
    category: "Camera Challenge",
    duration: "3 min",
    description: "Channel your positive, joyful energy into recreating iconic hilarious memes.",
    color: "#FFD83D",
    art: "camera",
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
  Frustrated: {
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
 * Defaults to Cloud Catcher for Sad/Overwhelmed, Meme Recreation for Happy, Bubble Burst for Angry.
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
  if (
    normalized.includes("angry") ||
    normalized.includes("spark") ||
    normalized.includes("frustrat")
  ) {
    return MOOD_ACTIVITY_MAPPING.Angry;
  }

  return MOOD_ACTIVITY_MAPPING.Sad;
}
