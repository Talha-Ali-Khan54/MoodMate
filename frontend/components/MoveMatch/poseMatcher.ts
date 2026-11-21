// // import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

// // const MIN_VISIBILITY = 0.5;

// // function vis(lm: NormalizedLandmark | undefined): boolean {
// //   return !!lm && (lm.visibility ?? 1) >= MIN_VISIBILITY;
// // }

// // // MediaPipe Pose landmark indices
// // const L_SHOULDER = 11;
// // const R_SHOULDER = 12;
// // const L_ELBOW = 13;
// // const R_ELBOW = 14;
// // const L_WRIST = 15;
// // const R_WRIST = 16;
// // const L_HIP = 23;
// // const R_HIP = 24;
// // const L_ANKLE = 27;
// // const R_ANKLE = 28;

// // export type PoseId = "star" | "side" | "reach";

// // /**
// //  * Star Stretch — feet apart, both arms diagonally up-and-out.
// //  */
// // export function isStarStretch(lm: NormalizedLandmark[]): boolean {
// //   const ls = lm[L_SHOULDER];
// //   const rs = lm[R_SHOULDER];
// //   const lw = lm[L_WRIST];
// //   const rw = lm[R_WRIST];
// //   const la = lm[L_ANKLE];
// //   const ra = lm[R_ANKLE];

// //   if (![ls, rs, lw, rw, la, ra].every(vis)) return false;

// //   // Both wrists above their corresponding shoulders
// //   const lwUp = lw.y < ls.y - 0.05;
// //   const rwUp = rw.y < rs.y - 0.05;

// //   // Wrists spread wide out from body center
// //   const centerX = (ls.x + rs.x) / 2;
// //   const lwWide = lw.x < centerX - 0.15;
// //   const rwWide = rw.x > centerX + 0.15;

// //   // Feet apart
// //   const feetApart = Math.abs(la.x - ra.x) > 0.15;

// //   return lwUp && rwUp && lwWide && rwWide && feetApart;
// // }

// // /**
// //  * Side Stretch — one arm raised overhead, shoulders tilted.
// //  */
// // export function isSideStretch(lm: NormalizedLandmark[]): boolean {
// //   const ls = lm[L_SHOULDER];
// //   const rs = lm[R_SHOULDER];
// //   const lw = lm[L_WRIST];
// //   const rw = lm[R_WRIST];

// //   if (![ls, rs, lw, rw].every(vis)) return false;

// //   const topShoulderY = Math.min(ls.y, rs.y);

// //   // At least one wrist well above both shoulders
// //   const lwHigh = lw.y < topShoulderY - 0.10;
// //   const rwHigh = rw.y < topShoulderY - 0.10;

// //   // Shoulders visibly tilted
// //   const tilt = Math.abs(ls.y - rs.y);
// //   const tilted = tilt > 0.04;

// //   return (lwHigh || rwHigh) && tilted;
// // }

// // /**
// //  * Standing Reach — upright body, both arms straight up.
// //  */
// // export function isStandingReach(lm: NormalizedLandmark[]): boolean {
// //   const ls = lm[L_SHOULDER];
// //   const rs = lm[R_SHOULDER];
// //   const lw = lm[L_WRIST];
// //   const rw = lm[R_WRIST];

// //   if (![ls, rs, lw, rw].every(vis)) return false;

// //   const topShoulderY = Math.min(ls.y, rs.y);

// //   // Both wrists above both shoulders
// //   const bothUp = lw.y < topShoulderY - 0.10 && rw.y < topShoulderY - 0.10;

// //   // Shoulders nearly horizontal (upright body)
// //   const upright = Math.abs(ls.y - rs.y) < 0.05;

// //   return bothUp && upright;
// // }

// // export function matchesPose(id: PoseId, lm: NormalizedLandmark[]): boolean {
// //   if (id === "star") return isStarStretch(lm);
// //   if (id === "side") return isSideStretch(lm);
// //   return isStandingReach(lm);
// // }






















































// import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

// export type PoseId = "star" | "side" | "reach";

// const MIN_VISIBILITY = 0.5;
// const L_SHOULDER = 11, R_SHOULDER = 12, L_WRIST = 15, R_WRIST = 16, L_ANKLE = 27, R_ANKLE = 28;

// const visible = (lm?: NormalizedLandmark) => !!lm && (lm.visibility ?? 1) >= MIN_VISIBILITY;

// /**
//  * Shoulder frame used by every rule. All thresholds are multiples of the shoulder width (sw),
//  * so detection works the same whether the user is close to or far from the camera.
//  * Note: MediaPipe's "left" is the person's left, which is the RIGHT side of an unmirrored frame,
//  * so no rule may depend on which image side a wrist is on. Use distances from the body centre instead.
//  */
// function frame(lm: NormalizedLandmark[]) {
//   const ls = lm[L_SHOULDER], rs = lm[R_SHOULDER], lw = lm[L_WRIST], rw = lm[R_WRIST];
//   if (![ls, rs, lw, rw].every(visible)) return null;
//   const sw = Math.abs(ls.x - rs.x);
//   if (sw < 0.04) return null; // body turned sideways or too far away
//   return { ls, rs, lw, rw, sw, cx: (ls.x + rs.x) / 2, top: Math.min(ls.y, rs.y) };
// }

// /** Star Stretch: both arms up and out on opposite sides, feet apart (feet only checked when visible). */
// export function isStarStretch(lm: NormalizedLandmark[]): boolean {
//   const f = frame(lm);
//   if (!f) return false;
//   const armsUp = f.lw.y < f.ls.y - 0.2 * f.sw && f.rw.y < f.rs.y - 0.2 * f.sw;
//   const armsOut = Math.abs(f.lw.x - f.cx) > 1.1 * f.sw && Math.abs(f.rw.x - f.cx) > 1.1 * f.sw;
//   const oppositeSides = (f.lw.x - f.cx) * (f.rw.x - f.cx) < 0;
//   const la = lm[L_ANKLE], ra = lm[R_ANKLE];
//   const feetOk = !(visible(la) && visible(ra)) || Math.abs(la.x - ra.x) > 1.2 * f.sw;
//   return armsUp && armsOut && oppositeSides && feetOk;
// }

// /** Side Stretch: either arm well above the shoulders, with a visible sideways shoulder tilt. */
// export function isSideStretch(lm: NormalizedLandmark[]): boolean {
//   const f = frame(lm);
//   if (!f) return false;
//   const raised = f.lw.y < f.top - 0.4 * f.sw || f.rw.y < f.top - 0.4 * f.sw;
//   const tilted = Math.abs(f.ls.y - f.rs.y) > 0.12 * f.sw;
//   return raised && tilted;
// }

// /** Standing Reach: both arms well above the shoulders, shoulders roughly level. */
// export function isStandingReach(lm: NormalizedLandmark[]): boolean {
//   const f = frame(lm);
//   if (!f) return false;
//   const bothUp = f.lw.y < f.top - 0.4 * f.sw && f.rw.y < f.top - 0.4 * f.sw;
//   const upright = Math.abs(f.ls.y - f.rs.y) < 0.2 * f.sw;
//   return bothUp && upright;
// }

// export function matchesPose(id: PoseId, lm: NormalizedLandmark[]): boolean {
//   if (id === "star") return isStarStretch(lm);
//   if (id === "side") return isSideStretch(lm);
//   return isStandingReach(lm);
// }





































import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type PoseId = "star" | "side" | "reach" | "open" | "hug";

const MIN_VISIBILITY = 0.5;
const L_SHOULDER = 11, R_SHOULDER = 12, L_WRIST = 15, R_WRIST = 16, L_ANKLE = 27, R_ANKLE = 28;

const visible = (lm?: NormalizedLandmark) => !!lm && (lm.visibility ?? 1) >= MIN_VISIBILITY;

/**
 * Shoulder frame used by every rule. All thresholds are multiples of the shoulder width (sw),
 * so detection works the same whether the user is close to or far from the camera.
 * Note: MediaPipe's "left" is the person's left, which is the RIGHT side of an unmirrored frame,
 * so no rule may depend on which image side a wrist is on. Use distances from the body centre instead.
 */
function frame(lm: NormalizedLandmark[]) {
  const ls = lm[L_SHOULDER], rs = lm[R_SHOULDER], lw = lm[L_WRIST], rw = lm[R_WRIST];
  if (![ls, rs, lw, rw].every(visible)) return null;
  const sw = Math.abs(ls.x - rs.x);
  if (sw < 0.04) return null; // body turned sideways or too far away
  return { ls, rs, lw, rw, sw, cx: (ls.x + rs.x) / 2, top: Math.min(ls.y, rs.y) };
}

/** Star Stretch: both arms up and out on opposite sides, feet apart (feet only checked when visible). */
export function isStarStretch(lm: NormalizedLandmark[]): boolean {
  const f = frame(lm);
  if (!f) return false;
  const armsUp = f.lw.y < f.ls.y - 0.2 * f.sw && f.rw.y < f.rs.y - 0.2 * f.sw;
  const armsOut = Math.abs(f.lw.x - f.cx) > 1.1 * f.sw && Math.abs(f.rw.x - f.cx) > 1.1 * f.sw;
  const oppositeSides = (f.lw.x - f.cx) * (f.rw.x - f.cx) < 0;
  const la = lm[L_ANKLE], ra = lm[R_ANKLE];
  const feetOk = !(visible(la) && visible(ra)) || Math.abs(la.x - ra.x) > 1.2 * f.sw;
  return armsUp && armsOut && oppositeSides && feetOk;
}

/** Side Stretch: either arm well above the shoulders, with a visible sideways shoulder tilt. */
export function isSideStretch(lm: NormalizedLandmark[]): boolean {
  const f = frame(lm);
  if (!f) return false;
  const raised = f.lw.y < f.top - 0.4 * f.sw || f.rw.y < f.top - 0.4 * f.sw;
  const tilted = Math.abs(f.ls.y - f.rs.y) > 0.12 * f.sw;
  return raised && tilted;
}

/** Standing Reach: both arms well above the shoulders, shoulders roughly level. */
export function isStandingReach(lm: NormalizedLandmark[]): boolean {
  const f = frame(lm);
  if (!f) return false;
  const bothUp = f.lw.y < f.top - 0.4 * f.sw && f.rw.y < f.top - 0.4 * f.sw;
  const upright = Math.abs(f.ls.y - f.rs.y) < 0.2 * f.sw;
  return bothUp && upright;
}

/** Open Arms: both arms straight out to the sides at shoulder height (a "T"). */
export function isOpenArms(lm: NormalizedLandmark[]): boolean {
  const f = frame(lm);
  if (!f) return false;
  const level = Math.abs(f.lw.y - f.ls.y) < 0.35 * f.sw && Math.abs(f.rw.y - f.rs.y) < 0.35 * f.sw;
  const wide = Math.abs(f.lw.x - f.cx) > 1.3 * f.sw && Math.abs(f.rw.x - f.cx) > 1.3 * f.sw;
  const oppositeSides = (f.lw.x - f.cx) * (f.rw.x - f.cx) < 0;
  return level && wide && oppositeSides;
}

/** Self Hug: arms crossed over the chest, each wrist near the opposite shoulder. */
export function isSelfHug(lm: NormalizedLandmark[]): boolean {
  const f = frame(lm);
  if (!f) return false;
  const near = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y) < 0.75 * f.sw;
  return near(f.lw, f.rs) && near(f.rw, f.ls);
}

export function matchesPose(id: PoseId, lm: NormalizedLandmark[]): boolean {
  if (id === "star") return isStarStretch(lm);
  if (id === "side") return isSideStretch(lm);
  if (id === "reach") return isStandingReach(lm);
  if (id === "open") return isOpenArms(lm);
  return isSelfHug(lm);
}