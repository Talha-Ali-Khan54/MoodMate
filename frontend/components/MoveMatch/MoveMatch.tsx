// "use client";

// import { JSX, useCallback, useEffect, useRef, useState } from "react";
// import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
// import { usePoseLandmarker } from "@/hooks/usePoseLandmarker";
// import { matchesPose, type PoseId } from "./poseMatcher";
// import {
//   StarStretchSVG,
//   SideStretchSVG,
//   StandingReachSVG,
// } from "./PoseIllustrations";

// type Screen = "intro" | "playing" | "results";

// interface PoseDef {
//   id: PoseId;
//   name: string;
//   instruction: string;
//   SVG: (props: { color?: string; className?: string }) => JSX.Element;
// //   React.FC<{ color?: string; className?: string }>
//   timeoutSeconds: number;
// }

// const POSES: PoseDef[] = [
//   {
//     id: "star",
//     name: "Star Stretch",
//     instruction:
//       "Stand with your feet apart and stretch both arms diagonally up and out — like a star.",
//     SVG: StarStretchSVG,
//     timeoutSeconds: 20,
//   },
//   {
//     id: "side",
//     name: "Side Stretch",
//     instruction:
//       "Raise one arm above your head and gently lean your body toward the opposite side.",
//     SVG: SideStretchSVG,
//     timeoutSeconds: 20,
//   },
//   {
//     id: "reach",
//     name: "Standing Reach",
//     instruction:
//       "Stand upright and reach both arms straight up above your head.",
//     SVG: StandingReachSVG,
//     timeoutSeconds: 20,
//   },
// ];

// const HOLD_MS = 2500;
// const MIN_VISIBILITY = 0.4;

// export function MoveMatch({ go }: { go: (p: string) => void }) {
//   const [screen, setScreen] = useState<Screen>("intro");
//   const [poseIndex, setPoseIndex] = useState(0);
//   const [completed, setCompleted] = useState<boolean[]>([false, false, false]);
//   const [cameraError, setCameraError] = useState("");
//   const [secondsLeft, setSecondsLeft] = useState(POSES[0].timeoutSeconds);
//   const [matched, setMatched] = useState(false);
//   const [cameraReady, setCameraReady] = useState(false);

//   const videoRef = useRef<HTMLVideoElement | null>(null);
//   const canvasRef = useRef<HTMLCanvasElement | null>(null);
//   const streamRef = useRef<MediaStream | null>(null);
//   const holdStartRef = useRef<number | null>(null);
//   const sessionIdRef = useRef(0);
//   const matchedRef = useRef(false);

//   const currentPose = POSES[poseIndex];
//   const totalDone = completed.filter(Boolean).length;

//   // -------- camera start/stop --------
//   const stopCamera = useCallback(() => {
//     sessionIdRef.current += 1;
//     if (streamRef.current) {
//       streamRef.current.getTracks().forEach((t) => {
//         try { t.stop(); } catch {}
//       });
//       streamRef.current = null;
//     }
//     if (videoRef.current) {
//       try {
//         videoRef.current.pause();
//         videoRef.current.srcObject = null;
//       } catch {}
//     }
//     setCameraReady(false);
//     setMatched(false);
//     holdStartRef.current = null;
//     matchedRef.current = false;
//   }, []);

//   const startCamera = useCallback(async () => {
//     const session = ++sessionIdRef.current;
//     setCameraError("");
//     setCameraReady(false);

//     try {
//       if (!navigator.mediaDevices?.getUserMedia) {
//         throw new Error("Camera unavailable");
//       }
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: {
//           width: { ideal: 640 },
//           height: { ideal: 480 },
//           facingMode: "user",
//         },
//         audio: false,
//       });
//       if (sessionIdRef.current !== session) {
//         stream.getTracks().forEach((t) => t.stop());
//         return;
//       }
//       streamRef.current = stream;
//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;
//         try {
//           await videoRef.current.play();
//         } catch (err: any) {
//           if (err?.name !== "AbortError") {
//             console.warn("Video play warning:", err);
//           }
//         }
//         setCameraReady(true);
//       }
//     } catch (err: any) {
//       const isDenied = err?.name === "NotAllowedError";
//       setCameraError(
//         isDenied
//           ? "Camera permission was denied. Please allow it and try again."
//           : "Couldn't open your camera. Check that no other app is using it."
//       );
//     }
//   }, []);

//   // -------- video ref binder --------
//   const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
//     videoRef.current = node;
//     if (node && streamRef.current && node.srcObject !== streamRef.current) {
//       node.srcObject = streamRef.current;
//       node.play().catch(() => {});
//     }
//   }, []);

//   // -------- pose detection callback --------
//   const handlePoseDetected = useCallback(
//     (
//       landmarks: NormalizedLandmark[][],
//       dims: { width: number; height: number }
//     ) => {
//       drawSkeleton(landmarks[0], dims);

//       if (screen !== "playing" || !landmarks[0]) return;
//       const pose = landmarks[0];
//       const ok = matchesPose(currentPose.id, pose);

//       if (ok !== matchedRef.current) {
//         matchedRef.current = ok;
//         setMatched(ok);
//       }

//       if (ok) {
//         if (holdStartRef.current === null) {
//           holdStartRef.current = performance.now();
//         } else if (performance.now() - holdStartRef.current > HOLD_MS) {
//           completePose();
//         }
//       } else {
//         holdStartRef.current = null;
//       }
//     },
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//     [screen, poseIndex]
//   );

//   const { isModelLoading, isModelReady, hasPoseDetected } = usePoseLandmarker(
//     videoRef,
//     screen === "playing" && cameraReady,
//     handlePoseDetected,
//     (msg) => setCameraError(msg)
//   );

//   // -------- skeleton drawing --------
//   const drawSkeleton = (
//     landmarks: NormalizedLandmark[] | undefined,
//     dims: { width: number; height: number }
//   ) => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;
//     const ctx = canvas.getContext("2d");
//     if (!ctx) return;

//     canvas.width = dims.width;
//     canvas.height = dims.height;
//     ctx.clearRect(0, 0, canvas.width, canvas.height);

//     if (!landmarks) return;

//     const CONNECTIONS: [number, number][] = [
//       [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
//       [11, 23], [12, 24], [23, 24],
//       [23, 25], [25, 27], [24, 26], [26, 28],
//     ];

//     ctx.strokeStyle = matchedRef.current ? "#4cb87c" : "#75C9F5";
//     ctx.lineWidth = 4;
//     ctx.lineCap = "round";

//     for (const [a, b] of CONNECTIONS) {
//       const p1 = landmarks[a];
//       const p2 = landmarks[b];
//       if (!p1 || !p2) continue;
//       if ((p1.visibility ?? 1) < MIN_VISIBILITY) continue;
//       if ((p2.visibility ?? 1) < MIN_VISIBILITY) continue;
//       ctx.beginPath();
//       ctx.moveTo(p1.x * dims.width, p1.y * dims.height);
//       ctx.lineTo(p2.x * dims.width, p2.y * dims.height);
//       ctx.stroke();
//     }

//     ctx.fillStyle = matchedRef.current ? "#4cb87c" : "#FFD83D";
//     for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
//       const p = landmarks[i];
//       if (!p) continue;
//       if ((p.visibility ?? 1) < MIN_VISIBILITY) continue;
//       ctx.beginPath();
//       ctx.arc(p.x * dims.width, p.y * dims.height, 5, 0, Math.PI * 2);
//       ctx.fill();
//     }
//   };

//   // -------- completion --------
//   const completePose = () => {
//     const next = [...completed];
//     next[poseIndex] = true;
//     setCompleted(next);
//     holdStartRef.current = null;

//     if (poseIndex < POSES.length - 1) {
//       setTimeout(() => {
//         setPoseIndex(poseIndex + 1);
//         setSecondsLeft(POSES[poseIndex + 1].timeoutSeconds);
//         setMatched(false);
//         matchedRef.current = false;
//       }, 900);
//     } else {
//       stopCamera();
//       setScreen("results");
//     }
//   };

//   const skipPose = () => {
//     holdStartRef.current = null;
//     matchedRef.current = false;
//     setMatched(false);

//     if (poseIndex < POSES.length - 1) {
//       setPoseIndex(poseIndex + 1);
//       setSecondsLeft(POSES[poseIndex + 1].timeoutSeconds);
//     } else {
//       stopCamera();
//       setScreen("results");
//     }
//   };

//   // -------- per-pose timer --------
//   useEffect(() => {
//     if (screen !== "playing") return;
//     if (matched) return;
//     if (!cameraReady) return;

//     setSecondsLeft(POSES[poseIndex].timeoutSeconds);
//     const timer = setInterval(() => {
//       setSecondsLeft((s) => {
//         if (s <= 1) {
//           skipPose();
//           return POSES[poseIndex].timeoutSeconds;
//         }
//         return s - 1;
//       });
//     }, 1000);

//     return () => clearInterval(timer);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [poseIndex, screen, matched, cameraReady]);

//   // -------- unmount cleanup --------
//   useEffect(() => {
//     return () => {
//       stopCamera();
//     };
//   }, [stopCamera]);

//   const startActivity = () => {
//     setCompleted([false, false, false]);
//     setPoseIndex(0);
//     setMatched(false);
//     matchedRef.current = false;
//     holdStartRef.current = null;
//     setSecondsLeft(POSES[0].timeoutSeconds);
//     setScreen("playing");
//     startCamera();
//   };















































// "use client";

// import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
// import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
// import { usePoseLandmarker } from "@/hooks/usePoseLandmarker";
// import { matchesPose, type PoseId } from "./poseMatcher";
// import {
//   StarStretchSVG,
//   SideStretchSVG,
//   StandingReachSVG,
// } from "./PoseIllustrations";

// type Screen = "intro" | "playing" | "results";

// interface PoseDef {
//   id: PoseId;
//   name: string;
//   instruction: string;
//   SVG: ComponentType<{ color?: string; className?: string }>;
//   timeoutSeconds: number;
// }

// const POSES: PoseDef[] = [
//   {
//     id: "star",
//     name: "Star Stretch",
//     instruction:
//       "Stand with your feet apart and stretch both arms diagonally up and out — like a star.",
//     SVG: StarStretchSVG,
//     timeoutSeconds: 20,
//   },
//   {
//     id: "side",
//     name: "Side Stretch",
//     instruction:
//       "Raise one arm above your head and gently lean your body toward the opposite side.",
//     SVG: SideStretchSVG,
//     timeoutSeconds: 20,
//   },
//   {
//     id: "reach",
//     name: "Standing Reach",
//     instruction:
//       "Stand upright and reach both arms straight up above your head.",
//     SVG: StandingReachSVG,
//     timeoutSeconds: 20,
//   },
// ];

// const HOLD_MS = 2500;
// const NEXT_POSE_DELAY_MS = 900;
// const MIN_VISIBILITY = 0.4;

// const CONNECTIONS: [number, number][] = [
//   [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
//   [11, 23], [12, 24], [23, 24],
//   [23, 25], [25, 27], [24, 26], [26, 28],
// ];
// const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

// export function MoveMatch({ go }: { go: (p: "activities") => void }) {
//   const [screen, setScreen] = useState<Screen>("intro");
//   const [poseIndex, setPoseIndex] = useState(0);
//   const [completed, setCompleted] = useState<boolean[]>([false, false, false]);
//   const [cameraError, setCameraError] = useState("");
//   const [secondsLeft, setSecondsLeft] = useState(POSES[0].timeoutSeconds);
//   const [matched, setMatched] = useState(false);
//   const [cameraReady, setCameraReady] = useState(false);

//   const videoRef = useRef<HTMLVideoElement | null>(null);
//   const canvasRef = useRef<HTMLCanvasElement | null>(null);
//   const streamRef = useRef<MediaStream | null>(null);
//   const sessionIdRef = useRef(0);
//   const holdStartRef = useRef<number | null>(null);
//   const matchedRef = useRef(false);
//   // Latest values for the per-frame callback (it must not depend on stale render closures)
//   const screenRef = useRef<Screen>("intro");
//   const poseIndexRef = useRef(0);
//   const completedRef = useRef<boolean[]>([false, false, false]);
//   const busyRef = useRef(false); // true while a matched pose is moving to the next one
//   const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

//   const currentPose = POSES[poseIndex];
//   const totalDone = completed.filter(Boolean).length;

//   // -------- camera start/stop --------
//   const stopCamera = useCallback(() => {
//     sessionIdRef.current += 1;
//     if (advanceTimerRef.current) {
//       clearTimeout(advanceTimerRef.current);
//       advanceTimerRef.current = null;
//     }
//     streamRef.current?.getTracks().forEach((t) => {
//       try { t.stop(); } catch {}
//     });
//     streamRef.current = null;
//     if (videoRef.current) {
//       try {
//         videoRef.current.pause();
//         videoRef.current.srcObject = null;
//       } catch {}
//     }
//     setCameraReady(false);
//     setMatched(false);
//     holdStartRef.current = null;
//     matchedRef.current = false;
//     busyRef.current = false;
//   }, []);

//   const startCamera = useCallback(async () => {
//     const session = ++sessionIdRef.current;
//     setCameraError("");
//     setCameraReady(false);

//     try {
//       if (!navigator.mediaDevices?.getUserMedia) {
//         throw new Error("Camera unavailable");
//       }
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
//         audio: false,
//       });
//       if (sessionIdRef.current !== session) {
//         stream.getTracks().forEach((t) => t.stop());
//         return;
//       }
//       streamRef.current = stream;
//       const video = videoRef.current;
//       if (video) {
//         video.srcObject = stream;
//         try {
//           await video.play();
//         } catch (err) {
//           if ((err as DOMException)?.name !== "AbortError") console.warn("Video play warning:", err);
//         }
//         if (sessionIdRef.current === session) setCameraReady(true);
//       }
//       // If the <video> isn't mounted yet, handleVideoRef attaches the stream when it is.
//     } catch (err) {
//       if (sessionIdRef.current !== session) return;
//       const denied = err instanceof DOMException && err.name === "NotAllowedError";
//       setCameraError(
//         denied
//           ? "Camera permission was denied. Please allow it and try again."
//           : "Couldn't open your camera. Check that no other app is using it."
//       );
//     }
//   }, []);

//   const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
//     videoRef.current = node;
//     const stream = streamRef.current;
//     if (node && stream && node.srcObject !== stream) {
//       node.srcObject = stream;
//       node.play().catch(() => {});
//       setCameraReady(true);
//     }
//   }, []);

//   // -------- progress --------
//   const goToNextPose = useCallback(() => {
//     holdStartRef.current = null;
//     matchedRef.current = false;
//     busyRef.current = false;
//     setMatched(false);
//     const i = poseIndexRef.current;
//     if (i < POSES.length - 1) {
//       poseIndexRef.current = i + 1;
//       setPoseIndex(i + 1);
//       setSecondsLeft(POSES[i + 1].timeoutSeconds);
//     } else {
//       stopCamera();
//       screenRef.current = "results";
//       setScreen("results");
//     }
//   }, [stopCamera]);

//   const completePose = useCallback(() => {
//     if (busyRef.current) return;
//     busyRef.current = true;
//     holdStartRef.current = null;
//     const next = [...completedRef.current];
//     next[poseIndexRef.current] = true;
//     completedRef.current = next;
//     setCompleted(next);
//     advanceTimerRef.current = setTimeout(() => {
//       advanceTimerRef.current = null;
//       goToNextPose();
//     }, NEXT_POSE_DELAY_MS);
//   }, [goToNextPose]);

//   const skipPose = useCallback(() => {
//     if (busyRef.current) return; // a pose was just matched; let it finish
//     goToNextPose();
//   }, [goToNextPose]);

//   // -------- skeleton drawing (refs only, no React state per frame) --------
//   const drawSkeleton = useCallback(
//     (landmarks: NormalizedLandmark[] | undefined, dims: { width: number; height: number }) => {
//       const canvas = canvasRef.current;
//       const ctx = canvas?.getContext("2d");
//       if (!canvas || !ctx) return;
//       if (canvas.width !== dims.width) canvas.width = dims.width;
//       if (canvas.height !== dims.height) canvas.height = dims.height;
//       ctx.clearRect(0, 0, canvas.width, canvas.height);
//       if (!landmarks) return;

//       const ok = (p?: NormalizedLandmark) => !!p && (p.visibility ?? 1) >= MIN_VISIBILITY;
//       ctx.strokeStyle = matchedRef.current ? "#4cb87c" : "#75C9F5";
//       ctx.lineWidth = 4;
//       ctx.lineCap = "round";
//       for (const [a, b] of CONNECTIONS) {
//         const p1 = landmarks[a], p2 = landmarks[b];
//         if (!ok(p1) || !ok(p2)) continue;
//         ctx.beginPath();
//         ctx.moveTo(p1.x * dims.width, p1.y * dims.height);
//         ctx.lineTo(p2.x * dims.width, p2.y * dims.height);
//         ctx.stroke();
//       }
//       ctx.fillStyle = matchedRef.current ? "#4cb87c" : "#FFD83D";
//       for (const i of JOINTS) {
//         const p = landmarks[i];
//         if (!ok(p)) continue;
//         ctx.beginPath();
//         ctx.arc(p.x * dims.width, p.y * dims.height, 5, 0, Math.PI * 2);
//         ctx.fill();
//       }
//     },
//     []
//   );

//   // -------- pose detection callback (runs every video frame) --------
//   const handlePoseDetected = useCallback(
//     (landmarks: NormalizedLandmark[][], dims: { width: number; height: number }) => {
//       const pose = landmarks[0];
//       drawSkeleton(pose, dims);
//       if (screenRef.current !== "playing" || busyRef.current) return;

//       const ok = !!pose && matchesPose(POSES[poseIndexRef.current].id, pose);
//       if (ok !== matchedRef.current) {
//         matchedRef.current = ok;
//         setMatched(ok);
//       }
//       if (!ok) {
//         holdStartRef.current = null;
//         return;
//       }
//       if (holdStartRef.current === null) holdStartRef.current = performance.now();
//       else if (performance.now() - holdStartRef.current >= HOLD_MS) completePose();
//     },
//     [drawSkeleton, completePose]
//   );

//   const { isModelLoading, isModelReady, hasPoseDetected } = usePoseLandmarker(
//     videoRef,
//     screen === "playing" && cameraReady,
//     handlePoseDetected,
//     (msg) => setCameraError(msg)
//   );

//   // -------- per-pose countdown (skips automatically at 0) --------
//   useEffect(() => {
//     if (screen !== "playing" || !cameraReady || matched) return;
//     const deadline = Date.now() + POSES[poseIndex].timeoutSeconds * 1000;
//     setSecondsLeft(POSES[poseIndex].timeoutSeconds);
//     const timer = setInterval(() => {
//       const left = Math.ceil((deadline - Date.now()) / 1000);
//       if (left <= 0) {
//         clearInterval(timer);
//         skipPose();
//       } else {
//         setSecondsLeft(left);
//       }
//     }, 250);
//     return () => clearInterval(timer);
//   }, [poseIndex, screen, matched, cameraReady, skipPose]);

//   // -------- leaving the activity: stop camera, loop and timers --------
//   useEffect(() => () => stopCamera(), [stopCamera]);

//   const startActivity = () => {
//     stopCamera(); // clears anything left over from a previous session
//     completedRef.current = [false, false, false];
//     setCompleted([false, false, false]);
//     poseIndexRef.current = 0;
//     setPoseIndex(0);
//     setSecondsLeft(POSES[0].timeoutSeconds);
//     screenRef.current = "playing";
//     setScreen("playing");
//     startCamera();
//   };






































































































"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { usePoseLandmarker } from "@/hooks/usePoseLandmarker";
import { matchesPose, type PoseId } from "./poseMatcher";
import {
  StarStretchSVG,
  SideStretchSVG,
  StandingReachSVG,
  OpenArmsSVG,
  SelfHugSVG,
} from "./PoseIllustrations";

type Screen = "intro" | "playing" | "results";

interface PoseDef {
  id: PoseId;
  name: string;
  short: string;
  instruction: string;
  SVG: ComponentType<{ color?: string; className?: string }>;
  timeoutSeconds: number;
}

const POSES: PoseDef[] = [
  {
    id: "star",
    name: "Star Stretch",
    short: "Feet apart, arms out.",
    instruction:
      "Stand with your feet apart and stretch both arms diagonally up and out — like a star.",
    SVG: StarStretchSVG,
    timeoutSeconds: 20,
  },
  {
    id: "side",
    name: "Side Stretch",
    short: "One arm up, gentle lean.",
    instruction:
      "Raise one arm above your head and gently lean your body toward the opposite side.",
    SVG: SideStretchSVG,
    timeoutSeconds: 20,
  },
  {
    id: "reach",
    name: "Standing Reach",
    short: "Both arms straight up.",
    instruction:
      "Stand upright and reach both arms straight up above your head.",
    SVG: StandingReachSVG,
    timeoutSeconds: 20,
  },
  {
    id: "open",
    name: "Open Arms",
    short: "Arms straight out, like a T.",
    instruction:
      "Stand tall and stretch both arms straight out to the sides at shoulder height.",
    SVG: OpenArmsSVG,
    timeoutSeconds: 20,
  },
  {
    id: "hug",
    name: "Self Hug",
    short: "Cross your arms over your chest.",
    instruction:
      "Cross your arms over your chest and give yourself a gentle hug.",
    SVG: SelfHugSVG,
    timeoutSeconds: 20,
  },
];

const HOLD_MS = 2500;
const NEXT_POSE_DELAY_MS = 900;
const MIN_VISIBILITY = 0.4;

const CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
];
const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

export function MoveMatch({ go }: { go: (p: "activities") => void }) {
  const [screen, setScreen] = useState<Screen>("intro");
  const [poseIndex, setPoseIndex] = useState(0);
  const [completed, setCompleted] = useState<boolean[]>(POSES.map(() => false));
  const [cameraError, setCameraError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(POSES[0].timeoutSeconds);
  const [matched, setMatched] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef(0);
  const holdStartRef = useRef<number | null>(null);
  const matchedRef = useRef(false);
  // Latest values for the per-frame callback (it must not depend on stale render closures)
  const screenRef = useRef<Screen>("intro");
  const poseIndexRef = useRef(0);
  const completedRef = useRef<boolean[]>(POSES.map(() => false));
  const busyRef = useRef(false); // true while a matched pose is moving to the next one
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPose = POSES[poseIndex];
  const totalDone = completed.filter(Boolean).length;

  // -------- camera start/stop --------
  const stopCamera = useCallback(() => {
    sessionIdRef.current += 1;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => {
      try { t.stop(); } catch {}
    });
    streamRef.current = null;
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {}
    }
    setCameraReady(false);
    setMatched(false);
    holdStartRef.current = null;
    matchedRef.current = false;
    busyRef.current = false;
  }, []);

  const startCamera = useCallback(async () => {
    const session = ++sessionIdRef.current;
    setCameraError("");
    setCameraReady(false);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera unavailable");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      if (sessionIdRef.current !== session) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch (err) {
          if ((err as DOMException)?.name !== "AbortError") console.warn("Video play warning:", err);
        }
        if (sessionIdRef.current === session) setCameraReady(true);
      }
      // If the <video> isn't mounted yet, handleVideoRef attaches the stream when it is.
    } catch (err) {
      if (sessionIdRef.current !== session) return;
      const denied = err instanceof DOMException && err.name === "NotAllowedError";
      setCameraError(
        denied
          ? "Camera permission was denied. Please allow it and try again."
          : "Couldn't open your camera. Check that no other app is using it."
      );
    }
  }, []);

  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    const stream = streamRef.current;
    if (node && stream && node.srcObject !== stream) {
      node.srcObject = stream;
      node.play().catch(() => {});
      setCameraReady(true);
    }
  }, []);

  // -------- progress --------
  const goToNextPose = useCallback(() => {
    holdStartRef.current = null;
    matchedRef.current = false;
    busyRef.current = false;
    setMatched(false);
    const i = poseIndexRef.current;
    if (i < POSES.length - 1) {
      poseIndexRef.current = i + 1;
      setPoseIndex(i + 1);
      setSecondsLeft(POSES[i + 1].timeoutSeconds);
    } else {
      stopCamera();
      screenRef.current = "results";
      setScreen("results");
    }
  }, [stopCamera]);

  const completePose = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    holdStartRef.current = null;
    const next = [...completedRef.current];
    next[poseIndexRef.current] = true;
    completedRef.current = next;
    setCompleted(next);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      goToNextPose();
    }, NEXT_POSE_DELAY_MS);
  }, [goToNextPose]);

  const skipPose = useCallback(() => {
    if (busyRef.current) return; // a pose was just matched; let it finish
    goToNextPose();
  }, [goToNextPose]);

  // -------- skeleton drawing (refs only, no React state per frame) --------
  const drawSkeleton = useCallback(
    (landmarks: NormalizedLandmark[] | undefined, dims: { width: number; height: number }) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      if (canvas.width !== dims.width) canvas.width = dims.width;
      if (canvas.height !== dims.height) canvas.height = dims.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!landmarks) return;

      const ok = (p?: NormalizedLandmark) => !!p && (p.visibility ?? 1) >= MIN_VISIBILITY;
      ctx.strokeStyle = matchedRef.current ? "#4cb87c" : "#75C9F5";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      for (const [a, b] of CONNECTIONS) {
        const p1 = landmarks[a], p2 = landmarks[b];
        if (!ok(p1) || !ok(p2)) continue;
        ctx.beginPath();
        ctx.moveTo(p1.x * dims.width, p1.y * dims.height);
        ctx.lineTo(p2.x * dims.width, p2.y * dims.height);
        ctx.stroke();
      }
      ctx.fillStyle = matchedRef.current ? "#4cb87c" : "#FFD83D";
      for (const i of JOINTS) {
        const p = landmarks[i];
        if (!ok(p)) continue;
        ctx.beginPath();
        ctx.arc(p.x * dims.width, p.y * dims.height, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    []
  );

  // -------- pose detection callback (runs every video frame) --------
  const handlePoseDetected = useCallback(
    (landmarks: NormalizedLandmark[][], dims: { width: number; height: number }) => {
      const pose = landmarks[0];
      drawSkeleton(pose, dims);
      if (screenRef.current !== "playing" || busyRef.current) return;

      const ok = !!pose && matchesPose(POSES[poseIndexRef.current].id, pose);
      if (ok !== matchedRef.current) {
        matchedRef.current = ok;
        setMatched(ok);
      }
      if (!ok) {
        holdStartRef.current = null;
        return;
      }
      if (holdStartRef.current === null) holdStartRef.current = performance.now();
      else if (performance.now() - holdStartRef.current >= HOLD_MS) completePose();
    },
    [drawSkeleton, completePose]
  );

  const { isModelLoading, isModelReady, hasPoseDetected } = usePoseLandmarker(
    videoRef,
    screen === "playing" && cameraReady,
    handlePoseDetected,
    (msg) => setCameraError(msg)
  );

  // -------- per-pose countdown (skips automatically at 0) --------
  useEffect(() => {
    if (screen !== "playing" || !cameraReady || matched) return;
    const deadline = Date.now() + POSES[poseIndex].timeoutSeconds * 1000;
    setSecondsLeft(POSES[poseIndex].timeoutSeconds);
    const timer = setInterval(() => {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(timer);
        skipPose();
      } else {
        setSecondsLeft(left);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [poseIndex, screen, matched, cameraReady, skipPose]);

  // -------- leaving the activity: stop camera, loop and timers --------
  useEffect(() => () => stopCamera(), [stopCamera]);

  const startActivity = () => {
    stopCamera(); // clears anything left over from a previous session
    completedRef.current = POSES.map(() => false);
    setCompleted(POSES.map(() => false));
    poseIndexRef.current = 0;
    setPoseIndex(0);
    setSecondsLeft(POSES[0].timeoutSeconds);
    screenRef.current = "playing";
    setScreen("playing");
    startCamera();
  };




  // =========================================================
  // INTRO
  // =========================================================
  if (screen === "intro") {
    return (
      <div className="page max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => go("activities")}
            className="flex items-center gap-2 py-2 px-4 rounded-xl bg-white border-2 border-[#20213F] font-bold text-sm text-[#20213F] shadow-[3px_3px_0px_#20213F] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_#20213F] transition-all"
          >
            ← Back to Activities
          </button>
        </div>

        <div className="bg-[#FFFDF8] rounded-3xl border-2 border-[#20213F] p-6 md:p-10 shadow-[8px_9px_0px_#20213F]">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF0A6] border border-[#FFD83D] text-[#20213F] font-bold text-xs uppercase tracking-wider">
                <span>🏃</span>
                <span>Move Your Body</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold text-[#20213F] font-fredoka leading-tight">
                Move &amp; Match
              </h1>

              <p className="text-lg text-[#20213F]/80 font-medium leading-relaxed">
                Get moving! Match three simple poses and give your body a quick reset.
              </p>

              <p className="text-sm text-[#20213F]/70 leading-relaxed">
                We'll use your webcam to track your body and check whether you're
                holding each pose. Nothing is recorded or uploaded — everything
                happens on your device.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-[#FFF9ED] border border-[#20213F]/15">
                  <div className="font-bold text-sm text-[#20213F] mb-1">⭐ Star Stretch</div>
                  <p className="text-xs text-[#20213F]/70">Feet apart, arms out.</p>
                </div>
                <div className="p-3 rounded-2xl bg-[#FFF9ED] border border-[#20213F]/15">
                  <div className="font-bold text-sm text-[#20213F] mb-1">↔️ Side Stretch</div>
                  <p className="text-xs text-[#20213F]/70">One arm up, gentle lean.</p>
                </div>
                <div className="p-3 rounded-2xl bg-[#FFF9ED] border border-[#20213F]/15">
                  <div className="font-bold text-sm text-[#20213F] mb-1">🙌 Standing Reach</div>
                  <p className="text-xs text-[#20213F]/70">Both arms straight up.</p>
                </div>
              </div>

              {cameraError && (
                <p className="text-sm text-[#FF765E] font-bold pt-2">{cameraError}</p>
              )}

              <div className="pt-4">
                <button
                  onClick={startActivity}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#FFD83D] text-[#20213F] font-extrabold text-lg font-fredoka border-2 border-[#20213F] shadow-[5px_5px_0px_#20213F] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#20213F] transition-all cursor-pointer"
                >
                  Start Activity →
                </button>
              </div>
            </div>

            <div className="md:col-span-5 flex items-center justify-center p-4 bg-[#FFF0A6]/60 rounded-2xl border-2 border-[#20213F]">
              <StarStretchSVG className="w-48 h-48" color="#20213F" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // RESULTS
  // =========================================================
  if (screen === "results") {
    return (
      <div className="page max-w-3xl mx-auto px-4 py-8">
        <div className="bg-[#FFFDF8] rounded-3xl border-2 border-[#20213F] p-6 md:p-10 shadow-[8px_9px_0px_#20213F] space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-full bg-[#FFF0A6] border-2 border-[#20213F] flex items-center justify-center shadow-[4px_4px_0px_#20213F]">
              <span className="text-6xl">🎉</span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#A8E6C3] border border-[#20213F]/20 text-[#20213F] uppercase tracking-wider">
              SESSION COMPLETE
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#20213F] font-fredoka">
              {totalDone === 3
                ? "You matched all three!"
                : `${totalDone} of 5 poses matched`}
            </h1>
            <p className="text-base text-[#20213F]/75 max-w-lg mx-auto">
              Every bit of movement counts. Nice work.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {POSES.map((p, i) => (
              <div
                key={p.id}
                className="p-3 rounded-2xl bg-[#FFF9ED] border-2 border-[#20213F] shadow-[3px_3px_0px_#20213F]"
              >
                <div className="text-xs font-bold text-[#20213F]/60 mb-1">
                  POSE {i + 1}
                </div>
                <div className="text-sm font-bold text-[#20213F] mb-1">{p.name}</div>
                <div className={completed[i] ? "text-[#4cb87c] font-bold" : "text-[#FF765E] font-bold"}>
                  {completed[i] ? "✓ Done" : "— Skipped"}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={startActivity}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#FFD83D] text-[#20213F] font-extrabold border-2 border-[#20213F] shadow-[4px_4px_0px_#20213F] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#20213F] transition-all cursor-pointer"
            >
              🔄 Play Again
            </button>
            <button
              onClick={() => go("activities")}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white text-[#20213F] font-bold border-2 border-[#20213F] shadow-[4px_4px_0px_#20213F] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#20213F] transition-all cursor-pointer"
            >
              ← Back to Activities
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // PLAYING
  // =========================================================
  const SVG = currentPose.SVG;

  return (
    <div className="page max-w-6xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => { stopCamera(); go("activities"); }}
          className="flex items-center gap-2 py-2 px-4 rounded-xl bg-white border-2 border-[#20213F] font-bold text-sm text-[#20213F] shadow-[3px_3px_0px_#20213F] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_#20213F] transition-all"
        >
          ← Exit
        </button>

        <div className="flex items-center gap-2">
          {POSES.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full border border-[#20213F] ${
                completed[i]
                  ? "bg-[#4cb87c]"
                  : i === poseIndex
                  ? "bg-[#75C9F5]"
                  : "bg-white"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* TARGET POSE PANEL */}
        <div className="md:col-span-5 bg-[#FFFDF8] rounded-3xl border-2 border-[#20213F] p-5 shadow-[6px_7px_0px_#20213F] flex flex-col">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF0A6] border border-[#FFD83D] text-[#20213F] font-bold text-xs uppercase tracking-wider w-fit">
            POSE {poseIndex + 1} OF {POSES.length}
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#20213F] font-fredoka mt-3">
            {currentPose.name}
          </h2>
          <p className="text-sm text-[#20213F]/70 mt-2 leading-relaxed">
            {currentPose.instruction}
          </p>

          <div
            className={`mt-4 p-4 rounded-2xl border-2 transition-colors ${
              matched
                ? "bg-[#e9f9ef] border-[#4cb87c]"
                : "bg-[#FFF9ED] border-[#20213F]"
            }`}
          >
            <SVG
              className="w-full h-auto max-h-64"
              color={matched ? "#4cb87c" : "#20213F"}
            />
          </div>

          <div className="mt-4 text-sm font-bold text-center">
            {matched ? (
              <span className="text-[#4cb87c]">✓ Hold the pose…</span>
            ) : (
              <span className="text-[#20213F]/60">
                Match the pose — {secondsLeft}s left
              </span>
            )}
          </div>

          <button
            onClick={skipPose}
            className="mt-4 text-xs font-bold text-[#20213F]/60 underline hover:text-[#20213F]"
          >
            Skip this pose →
          </button>
        </div>

        {/* CAMERA PANEL */}
        <div className="md:col-span-7 bg-[#20213F] rounded-3xl border-2 border-[#20213F] p-3 shadow-[6px_7px_0px_#FFD83D]">
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black">
            <video
              ref={handleVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover -scale-x-100"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full -scale-x-100 pointer-events-none"
            />

            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 bg-[#FFFDF8] flex flex-col items-center justify-center space-y-3">
                <div className="w-10 h-10 border-4 border-[#FFD83D] border-t-transparent rounded-full animate-spin" />
                <p className="font-fredoka font-bold text-[#20213F]">
                  Starting camera…
                </p>
              </div>
            )}

            {cameraReady && isModelLoading && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center space-y-3 text-white">
                <div className="w-10 h-10 border-4 border-[#FFD83D] border-t-transparent rounded-full animate-spin" />
                <span className="font-fredoka font-bold">
                  Loading pose model…
                </span>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 bg-[#FFFDF8] flex flex-col items-center justify-center space-y-3 p-6 text-center">
                <span className="text-3xl">📷</span>
                <p className="text-sm text-[#20213F] font-bold">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 rounded-xl bg-[#FFD83D] text-[#20213F] font-bold text-sm border-2 border-[#20213F]"
                >
                  Try again
                </button>
              </div>
            )}

            {cameraReady && isModelReady && !hasPoseDetected && (
              <div className="absolute bottom-3 inset-x-3 bg-[#FF765E]/90 text-white text-xs font-bold text-center py-2 px-3 rounded-xl">
                Step back so your full body is visible
              </div>
            )}
          </div>

          <div className="mt-3 text-center">
            <p className="text-white/80 text-sm font-bold">
              {matched
                ? "Hold it — almost there!"
                : "Take your time. No rush."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}