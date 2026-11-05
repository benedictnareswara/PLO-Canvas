import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, readLightDarkTokens } from "./helpers/oklch";

const css = readFileSync(path.resolve(import.meta.dirname, "../src/app/globals.css"), "utf8");
const tokens = readLightDarkTokens(css);

const SURFACES = ["background", "surface", "surface-2"];

/** Text pairs need 4.5:1 (WCAG 1.4.3); UI and chart strokes need 3:1 (WCAG 1.4.11). */
const TEXT: [string, string][] = [
  ...["foreground", "muted", "subtle", "brand", "ok", "risk", "warn", "info"].flatMap((fg) =>
    SURFACES.map((bg): [string, string] => [fg, bg]),
  ),
  ...["brand", "ok", "risk", "warn", "info"].map((t): [string, string] => [t, `${t}-soft`]),
  ["brand-fg", "brand"],
  ["brand-fg", "brand-hover"],
  ["solid-fg", "ok"],
  ["solid-fg", "risk"],
  ["solid-fg", "warn"],
  ["chart-axis", "surface"],
  ["chart-tick", "surface"],
];

const UI: [string, string][] = [
  ...SURFACES.map((bg): [string, string] => ["border-input", bg]),
  ...["chart-1", "chart-2", "chart-3", "chart-target"].map((c): [string, string] => [c, "surface"]),
];

describe("design token contrast", () => {
  it("parses every light-dark() token", () => {
    expect(tokens.size).toBeGreaterThan(25);
  });

  for (const scheme of ["light", "dark"] as const) {
    describe(scheme, () => {
      it.each(TEXT)("text %s on %s ≥ 4.5:1", (fg, bg) => {
        expect(tokens.has(fg) && tokens.has(bg), `${fg}/${bg} defined`).toBe(true);
        expect(contrastRatio(tokens.get(fg)![scheme], tokens.get(bg)![scheme])).toBeGreaterThanOrEqual(4.5);
      });
      it.each(UI)("UI %s on %s ≥ 3:1", (fg, bg) => {
        expect(contrastRatio(tokens.get(fg)![scheme], tokens.get(bg)![scheme])).toBeGreaterThanOrEqual(3);
      });
    });
  }
});
