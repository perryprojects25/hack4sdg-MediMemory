// The pill shapes and colours the caregiver can pick from.
// The patient screen shows a big picture of each medicine using these.

import type { TranslationKey } from "./translations";

export const SHAPES = [
  { id: "round", form: "tablet", labelKey: "shapeRound" },
  { id: "oval", form: "tablet", labelKey: "shapeOval" },
  { id: "capsule", form: "capsule", labelKey: "shapeCapsule" },
  { id: "liquid", form: "liquid", labelKey: "shapeLiquid" },
] as const satisfies readonly { id: string; form: string; labelKey: TranslationKey }[];

export const COLORS = [
  { id: "white", hex: "#ffffff", labelKey: "colorWhite" },
  { id: "yellow", hex: "#facc15", labelKey: "colorYellow" },
  { id: "orange", hex: "#fb923c", labelKey: "colorOrange" },
  { id: "pink", hex: "#f9a8d4", labelKey: "colorPink" },
  { id: "red", hex: "#dc2626", labelKey: "colorRed" },
  { id: "blue", hex: "#3b82f6", labelKey: "colorBlue" },
  { id: "green", hex: "#22c55e", labelKey: "colorGreen" },
  { id: "brown", hex: "#92400e", labelKey: "colorBrown" },
] as const satisfies readonly { id: string; hex: string; labelKey: TranslationKey }[];

export type ShapeId = (typeof SHAPES)[number]["id"];
export type ColorId = (typeof COLORS)[number]["id"];

export function colorHex(color: string | null): string {
  return COLORS.find((c) => c.id === color)?.hex ?? "#ffffff";
}

export function shapeOption(shape: string | null) {
  return SHAPES.find((s) => s.id === shape) ?? SHAPES[0];
}

export function colorOption(color: string | null) {
  return COLORS.find((c) => c.id === color) ?? COLORS[0];
}

// "08:00:00" -> "08:00"
export function shortTime(time: string): string {
  return time.slice(0, 5);
}
