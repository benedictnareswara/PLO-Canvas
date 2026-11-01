/**
 * Radar series styles. Each series differs by colour (Okabe-Ito derived, tuned per theme in
 * globals.css), by line dash and by marker shape, so series stay distinguishable without colour
 * (WCAG 1.4.1) and in greyscale print. A radar overlay is capped at three series.
 */
export const SERIES = [
  { color: "var(--chart-1)", dash: undefined, marker: "circle" },
  { color: "var(--chart-2)", dash: "7 3", marker: "square" },
  { color: "var(--chart-3)", dash: "2 3", marker: "triangle" },
] as const;

export type MarkerShape = (typeof SERIES)[number]["marker"];

export const SERIES_COLORS = SERIES.map((s) => s.color);
export const TARGET_COLOR = "var(--chart-target)";
