/** Minimal OKLCH → linear sRGB → WCAG contrast, enough to check design tokens without a colour library. */

export interface Oklch {
  l: number; // 0–1
  c: number;
  h: number; // degrees
  alpha: number;
  /** Set for a colour written as hex: linear-light sRGB channels, used as they are. */
  rgb?: [number, number, number];
}

/** A `#rrggbb` colour, kept as linear-light sRGB. */
export function parseHex(src: string): Oklch {
  const m = src.trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!m) throw new Error(`Not a #rrggbb colour: ${src}`);
  const lin = (i: number) => {
    const v = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return { l: 0, c: 0, h: 0, alpha: 1, rgb: [lin(0), lin(2), lin(4)] };
}

export function parseColor(src: string): Oklch {
  return src.trim().startsWith("#") ? parseHex(src) : parseOklch(src);
}

export function parseOklch(src: string): Oklch {
  const m = src.trim().match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/);
  if (!m) throw new Error(`Not an oklch() colour: ${src}`);
  const l = Number(m[1]) / (m[2] ? 100 : 1);
  return { l, c: Number(m[3]), h: Number(m[4]), alpha: m[5] === undefined ? 1 : Number(m[5]) };
}

/** Linear-light sRGB channels, clipped to gamut. */
export function oklchToLinearSrgb({ l, c, h, rgb }: Oklch): [number, number, number] {
  if (rgb) return rgb;
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clip(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clip(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clip(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

export function relativeLuminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearSrgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Oklch, b: Oklch): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads `--name: light-dark(<colour>, <colour>);` declarations (oklch() or #rrggbb) from a stylesheet. */
export function readLightDarkTokens(css: string): Map<string, { light: Oklch; dark: Oklch }> {
  const out = new Map<string, { light: Oklch; dark: Oklch }>();
  const colour = String.raw`(oklch\([^)]*\)|#[0-9a-fA-F]{6})`;
  const re = new RegExp(String.raw`--([\w-]+):\s*light-dark\(\s*${colour}\s*,\s*${colour}\s*\)\s*;`, "g");
  for (const m of css.matchAll(re)) out.set(m[1], { light: parseColor(m[2]), dark: parseColor(m[3]) });
  return out;
}
