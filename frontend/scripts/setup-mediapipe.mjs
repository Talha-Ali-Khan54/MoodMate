// Copies the MediaPipe wasm runtime and downloads the face model into /public so the app runs offline.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const wasmSrc = "node_modules/@mediapipe/tasks-vision/wasm";
if (existsSync(wasmSrc)) cpSync(wasmSrc, "public/mediapipe/wasm", { recursive: true });

const model = "public/models/face_landmarker.task";
if (!existsSync(model)) {
  mkdirSync("public/models", { recursive: true });
  try {
    const res = await fetch("https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task");
    if (!res.ok) throw new Error(String(res.status));
    writeFileSync(model, Buffer.from(await res.arrayBuffer()));
    console.log("Downloaded face_landmarker.task");
  } catch {
    console.warn("Could not download the model. Put face_landmarker.task in public/models/ by hand.");
  }
}
