export interface Bubble {
  id: number;
  x: number;
  y: number;
  baseRadius: number;
  radius: number;
  color: string;
  glowColor: string;
  points: number;
  speedX: number;
  speedY: number;
  wobbleSpeed: number;
  wobblePhase: number;
  wobbleAmp: number;
  createdAt: number;
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
}

export interface PopEffect {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  points: number;
  text?: string;
  alpha: number;
  createdAt: number;
}

export interface CursorPoint {
  x: number;
  y: number;
  handIndex: number;
}

export interface CursorTrailPoint {
  x: number;
  y: number;
  alpha: number;
  handIndex: number;
}

export interface EncouragementToast {
  id: number;
  text: string;
  emoji: string;
  color: string;
  timestamp: number;
}

export type GameScreen = "intro" | "playing" | "results";
