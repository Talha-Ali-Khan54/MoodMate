// Landmarks -> normalised feature vector.
// IMPORTANT: order and formulas must match the training pipeline (Shahmeer's FeatureBuilder).
// Indices are MediaPipe Face Landmarker (478-point mesh).
export const FEATURE_NAMES = [
  "mouth_width", "mouth_opening", "left_eye_opening", "right_eye_opening",
  "left_lip_corner_height", "right_lip_corner_height",
  "left_brow_eye_dist", "right_brow_eye_dist", "mouth_nose_ratio",
] as const;

type P = { x: number; y: number };
const d = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

export function buildFeatures(p: P[]): number[] {
  const scale = d(p[33], p[263]) || 1; // outer eye corners = face_scale
  const mouthMidY = (p[13].y + p[14].y) / 2;
  return [
    d(p[61], p[291]) / scale,
    d(p[13], p[14]) / scale,
    d(p[159], p[145]) / scale,
    d(p[386], p[374]) / scale,
    (mouthMidY - p[61].y) / scale,  // > 0 when the corner is above the mouth centre (smile)
    (mouthMidY - p[291].y) / scale,
    d(p[105], p[159]) / scale,
    d(p[334], p[386]) / scale,
    d(p[1], p[13]) / scale,
  ];
}
