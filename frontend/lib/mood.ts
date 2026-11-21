export const EXPRESSIONS = ["happy", "sad", "angry", "neutral"] as const;
export type BackendExpression = (typeof EXPRESSIONS)[number];
export type Expression = BackendExpression;

// Frontend MediaPipe detects a wider spectrum of 7 emotional/affective expressions
export const FRONTEND_MOODS = [
  "Happy",
  "Sad",
  "Angry",
  "Neutral",
  "Overwhelmed",
  "Lazy",
  "Frustrated",
] as const;
export type FrontendMood = (typeof FRONTEND_MOODS)[number];

export type MoodKey = "sunny" | "cloudy" | "spark" | "wiggles";

// Backward-compatible mapping for the 4 RF classes
export const EXPRESSION_TO_MOOD: Record<BackendExpression, MoodKey> = {
  happy: "sunny",
  sad: "cloudy",
  angry: "spark",
  neutral: "wiggles",
};

// Map each frontend mood to the app's visual mascot / mood theme
export const FRONTEND_MOOD_TO_THEME: Record<FrontendMood, MoodKey> = {
  Happy: "sunny",
  Sad: "cloudy",
  Angry: "spark",
  Frustrated: "spark",
  Overwhelmed: "wiggles",
  Lazy: "cloudy",
  Neutral: "wiggles",
};

export interface BackendPredictionResult {
  label: BackendExpression | null;
  status: "success" | "unavailable";
  errorMsg?: string;
}

export interface HybridMoodResult {
  frontendMood: FrontendMood;
  backendPrediction: BackendPredictionResult;
  features: number[];
}

/**
 * Interpret MediaPipe facial landmark features into one of 7 frontend mood states:
 * Happy, Sad, Angry, Neutral, Overwhelmed, Lazy, Frustrated
 *
 * Feature indices:
 * 0: mouth_width
 * 1: mouth_opening
 * 2: left_eye_opening
 * 3: right_eye_opening
 * 4: left_brow_eye
 * 5: right_brow_eye
 * 6: corner_lift
 */
export function interpretFrontendMood(features: number[]): FrontendMood {
  if (!features || features.length < 7) {
    return "Neutral";
  }

  const mouthWidth = features[0];
  const mouthOpening = features[1];
  const leftEye = features[2];
  const rightEye = features[3];
  const eyeAvg = (leftEye + rightEye) / 2;
  const leftBrow = features[4];
  const rightBrow = features[5];
  const browAvg = (leftBrow + rightBrow) / 2;
  const browDiff = Math.abs(leftBrow - rightBrow);
  const cornerLift = features[6];

  // 1. Happy: distinct corner lift / smile
  if (cornerLift > 0.035 || (cornerLift > 0.02 && mouthWidth > 0.42)) {
    return "Happy";
  }

  // 2. Overwhelmed: wide eyes or raised brows with open/tense mouth
  if (browAvg > 0.20 && (eyeAvg > 0.075 || mouthOpening > 0.07)) {
    return "Overwhelmed";
  }

  // 3. Angry: strongly furrowed/lowered brows + tight lips
  if (browAvg < 0.145 && cornerLift < 0.01) {
    return "Angry";
  }

  // 4. Frustrated: furrowed brow, asymmetrical tension or clenched mouth
  if ((browDiff > 0.035 || browAvg < 0.16) && cornerLift < 0.0) {
    return "Frustrated";
  }

  // 5. Lazy / Tired / Sluggish: drooping eyelids, relaxed low tone
  if (eyeAvg < 0.052 && Math.abs(cornerLift) < 0.015 && mouthOpening < 0.05) {
    return "Lazy";
  }

  // 6. Sad: downturned corners, subtle frown
  if (cornerLift < -0.005) {
    return "Sad";
  }

  // 7. Default resting expression
  return "Neutral";
}
