export interface Star {
  id: number;
  x: number; // In canvas coordinates
  y: number;
  radius: number;
  speedY: number;
  wobblePhase: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  rotation: number;
  rotationSpeed: number;
  glowColor: string;
  isSpecial?: boolean;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  isStar?: boolean;
}

export interface BackgroundCloud {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  scale: number;
  opacity: number;
}

export type GameScreen = "intro" | "playing" | "completed";

export interface ComfortingMessage {
  text: string;
  emoji: string;
}

export const COMFORTING_MESSAGES: ComfortingMessage[] = [
  { text: "You don't have to figure everything out today.", emoji: "✨" },
  { text: "It's okay to take things one step at a time.", emoji: "🌱" },
  { text: "You are allowed to have difficult days.", emoji: "💙" },
  { text: "Small steps still count just as much.", emoji: "⭐" },
  { text: "You deserve kindness, especially from yourself.", emoji: "🌸" },
  { text: "This moment doesn't define your whole story.", emoji: "🌈" },
  { text: "You are doing so much better than you think.", emoji: "💫" },
  { text: "It's okay to pause, soften, and simply breathe.", emoji: "🕊️" },
  { text: "Tomorrow is a fresh, gentle opportunity.", emoji: "☀️" },
  { text: "You don't have to be perfect to be worthy.", emoji: "💛" },
];
