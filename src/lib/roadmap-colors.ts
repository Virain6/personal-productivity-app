import type { CSSProperties } from "react";
export const roadmapColors = {
  purple: "#AA9AF3",
  blue: "#86B8DC",
  green: "#70C9A5",
  orange: "#E8AD78",
  pink: "#E5A3C7",
  cyan: "#78CBD4",
  red: "#F59B9B",
  yellow: "#DFCF7C",
} as const;
export type RoadmapColor = keyof typeof roadmapColors;
export function roadmapColor(value?: string) {
  return roadmapColors[value as RoadmapColor] ?? roadmapColors.purple;
}
export function roadmapStyle(value?: string): CSSProperties {
  const color = roadmapColor(value);
  return {
    "--roadmap-accent": color,
    "--accent": color,
    "--accent-hover": color,
  } as CSSProperties;
}
