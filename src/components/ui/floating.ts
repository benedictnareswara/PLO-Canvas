export type FloatingSide = "top" | "bottom";
export type FloatingAlign = "start" | "center" | "end";

const VIEWPORT_PAD = 8;

/**
 * Positions a top-layer popover next to its anchor (fixed coordinates), flipping to the other
 * side when it would overflow and clamping it inside the viewport. Call after the popover is shown
 * so it can be measured.
 */
export function placeFloating(
  anchor: Element,
  floating: HTMLElement,
  { side = "bottom", align = "center", offset = 6 }: { side?: FloatingSide; align?: FloatingAlign; offset?: number } = {},
) {
  const a = anchor.getBoundingClientRect();
  const f = floating.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;

  let resolved = side;
  if (side === "bottom" && a.bottom + offset + f.height > vh - VIEWPORT_PAD && a.top - offset - f.height >= VIEWPORT_PAD) resolved = "top";
  if (side === "top" && a.top - offset - f.height < VIEWPORT_PAD && a.bottom + offset + f.height <= vh - VIEWPORT_PAD) resolved = "bottom";

  const top = resolved === "bottom" ? a.bottom + offset : a.top - offset - f.height;
  const rawLeft = align === "start" ? a.left : align === "end" ? a.right - f.width : a.left + a.width / 2 - f.width / 2;
  const left = Math.min(Math.max(VIEWPORT_PAD, rawLeft), vw - VIEWPORT_PAD - f.width);

  Object.assign(floating.style, { position: "fixed", inset: "auto", margin: "0", top: `${top}px`, left: `${left}px` });
  floating.dataset.side = resolved;
}
