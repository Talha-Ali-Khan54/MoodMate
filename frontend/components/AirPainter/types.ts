export interface Point {
  x: number;
  y: number;
  color: string;
  size: number;
  timestamp: number;
}

export interface Stroke {
  id: number;
  points: Point[];
  color: string;
  size: number;
}

export interface SparkleParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  maxLife: number;
  life: number;
}

export interface PaletteColor {
  name: string;
  hex: string;
  glow: string;
}

export const NEON_COLORS: PaletteColor[] = [
  { name: "Sunshine Gold", hex: "#FFD83D", glow: "rgba(255, 216, 61, 0.85)" },
  { name: "Electric Coral", hex: "#FF765E", glow: "rgba(255, 118, 94, 0.85)" },
  { name: "Neon Sky", hex: "#00E5FF", glow: "rgba(0, 229, 255, 0.85)" },
  { name: "Vibrant Mint", hex: "#4ECCA3", glow: "rgba(78, 204, 163, 0.85)" },
  { name: "Cosmic Lavender", hex: "#D946EF", glow: "rgba(217, 70, 239, 0.85)" },
  { name: "Pure Light", hex: "#FFFFFF", glow: "rgba(255, 255, 255, 0.95)" },
];

export type GameScreen = "intro" | "playing" | "results";