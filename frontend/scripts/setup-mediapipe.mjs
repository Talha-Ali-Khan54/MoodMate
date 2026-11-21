// Copies the MediaPipe wasm runtime and downloads the face & hand models into /public so the app runs offline.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const wasmSrc = "node_modules/@mediapipe/tasks-vision/wasm";
if (existsSync(wasmSrc)) cpSync(wasmSrc, "public/mediapipe/wasm", { recursive: true });

mkdirSync("public/models", { recursive: true });

const faceModel = "public/models/face_landmarker.task";
if (!existsSync(faceModel)) {
  try {
    const res = await fetch("https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task");
    if (!res.ok) throw new Error(String(res.status));
    writeFileSync(faceModel, Buffer.from(await res.arrayBuffer()));
    console.log("Downloaded face_landmarker.task");
  } catch {
    console.warn("Could not download the face model. Put face_landmarker.task in public/models/ by hand.");
  }
}

const handModel = "public/models/hand_landmarker.task";
if (!existsSync(handModel)) {
  try {
    const res = await fetch("https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task");
    if (!res.ok) throw new Error(String(res.status));
    writeFileSync(handModel, Buffer.from(await res.arrayBuffer()));
    console.log("Downloaded hand_landmarker.task");
  } catch {
    console.warn("Could not download the hand model. Put hand_landmarker.task in public/models/ by hand.");
  }
}


// ============================================================
// Pose Landmarker model (for Move & Match activity)
// ============================================================
const poseModel = "public/models/pose_landmarker.task";
if (!existsSync(poseModel)) {
  try {
    const res = await fetch(
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
    );
    if (!res.ok) throw new Error(String(res.status));
    writeFileSync(poseModel, Buffer.from(await res.arrayBuffer()));
    console.log("Downloaded pose_landmarker.task");
  } catch (err) {
    console.warn(
      "Could not download pose_landmarker.task.",
      err,
      "\nPut pose_landmarker.task in public/models/ by hand."
    );
  }
}