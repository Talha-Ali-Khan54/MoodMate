export type MemeTemplateId =
  | "two-panel"
  | "choice-meme"
  | "reaction-meme"
  | "expectation-reality";

export interface CaptionField {
  id: string;
  label: string;
  text: string;
  x: number; // 0 - 100 percentage of width
  y: number; // 0 - 100 percentage of height
  fontSize: number; // in px at native resolution
  color: string;
  strokeColor: string;
  align: "left" | "center" | "right";
  isUppercase: boolean;
}

export interface MemeTemplate {
  id: MemeTemplateId;
  title: string;
  description: string;
  image: string;
  aspectRatio: number; // width / height
  badge: string;
  tags: string[];
  defaultCaptions: CaptionField[];
}

export type FaceStickerStyle = "cutout" | "badge" | "circle" | "frame";

export interface FaceSticker {
  src: string; // Base64 data URL
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  scale: number; // 0.4 - 2.5
  rotation: number; // degrees
  style: FaceStickerStyle;
  borderWidth: number;
  borderColor: string;
  expressionLabel?: string;
}

export interface AccessorySticker {
  id: string;
  name: string;
  type: "sunglasses" | "tears" | "party_hat" | "clown_nose" | "speech_bubble" | "fire";
  x: number; // percentage
  y: number; // percentage
  scale: number;
  rotation: number;
  customText?: string;
}
