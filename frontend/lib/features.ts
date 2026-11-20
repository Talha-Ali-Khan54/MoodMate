
export const FEATURE_NAMES = [
  "mouth_width",
  "mouth_opening",
  "left_eye_opening",
  "right_eye_opening",
  "left_brow_eye",
  "right_brow_eye",
  "corner_lift",
] as const;

type P = {
  x: number;
  y: number;
};

const d = (a: P, b: P) =>
  Math.sqrt(
    (a.x - b.x) ** 2 +
    (a.y - b.y) ** 2
  );

export function buildFeatures(p: P[]): number[] {
  const faceWidth = d(p[234], p[454]);

  if (faceWidth === 0) {
    throw new Error("Invalid face width");
  }

  const mouthWidth =
    d(p[61], p[291]) / faceWidth;

  const mouthOpening =
    d(p[13], p[14]) / faceWidth;

  const leftEyeOpening =
    d(p[159], p[145]) / faceWidth;

  const rightEyeOpening =
    d(p[386], p[374]) / faceWidth;

  const leftBrowEye =
    d(p[105], p[159]) / faceWidth;

  const rightBrowEye =
    d(p[334], p[386]) / faceWidth;

  const mouthCenterY =
    (p[13].y + p[14].y) / 2;

  const mouthCornersY =
    (p[61].y + p[291].y) / 2;

  const cornerLift =
    (mouthCenterY - mouthCornersY) / faceWidth;

  return [
    mouthWidth,
    mouthOpening,
    leftEyeOpening,
    rightEyeOpening,
    leftBrowEye,
    rightBrowEye,
    cornerLift,
  ];
}
