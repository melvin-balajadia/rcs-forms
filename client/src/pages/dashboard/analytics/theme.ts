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

// Entries per form: how many forms show before "Show N more"
export const TOP_FORMS = 8;

// Returns: the "needs attention" color (most-returned forms, the pipeline's
// Returned stage). 4.2:1 on white.
export const RETURN_COLOR = "#c2610c";

// Approval pipeline stages: a blue ramp that darkens as an entry moves toward
// final approval (each at least 3:1 on white). The stage name is always shown,
// so color is never the only cue.
export const STAGE_COLORS: Record<string, string> = {
  pending: "#7f8a9e",
  first: "#4a8ce0",
  second: "#2a78d6",
  third: "#1a4f99",
  returned: RETURN_COLOR,
};

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
