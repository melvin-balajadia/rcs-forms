// Colors and ink for the dashboard charts.
//
// Series colors are categorical slots 1–2 of the reference data-viz palette,
// validated on the card surface (#ffffff, light mode): colorblind separation
// ΔE 24.7, normal-vision ΔE 33.6, both ≥ 3:1 contrast. A color always follows
// its area — filtering or hiding a series never repaints the others.

export const AREA_COLORS: Record<string, string> = {
  Main: "#2a78d6", // blue
  Annex: "#eb6834", // orange
  Other: "#898781", // entries with no area recorded
};

// Single-series charts (entries per form)
export const SINGLE_SERIES = AREA_COLORS.Main;

// Bars grow in on load, except for readers who asked their system for less
// motion (Recharts doesn't apply this to custom bar shapes on its own)
export const ANIMATE =
  typeof window === "undefined" ||
  !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const INK = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781", // axis ticks and labels
  grid: "#e1e0d9", // hairline gridlines
  axis: "#c3c2b7", // baseline
  hover: "rgba(11, 11, 11, 0.04)", // hovered column wash
};
