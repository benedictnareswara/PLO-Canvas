import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Colours go through the semantic tokens in globals.css so both themes stay readable. Raw palette
 * classes (`text-white`, `bg-red-50`) and hex literals look fine in light mode and break in dark.
 */
const SRC = path.resolve(import.meta.dirname, "../src");
const PALETTE =
  "white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const RAW_CLASS = new RegExp(
  String.raw`\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|decoration|shadow|accent|caret)-(?:${PALETTE})(?:-\d{2,3})?\b`,
  "g",
);
const HEX = /(?<![\w&])#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g;

/** Overlays are allowed to be black: a translucent scrim reads the same in both schemes. */
const ALLOWED = [/\bbg-black\/\d+\b/];
/** The one place literal colours are required (browser chrome can't read CSS variables). */
const ALLOWED_FILES = new Set(["lib/theme-colors.ts"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe("no raw colours in components", () => {
  const files = sourceFiles(SRC).filter((f) => !ALLOWED_FILES.has(path.relative(SRC, f)));

  it("finds source files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("uses only semantic colour tokens", () => {
    const offences: string[] = [];
    for (const file of files) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
          const cleaned = ALLOWED.reduce((l, re) => l.replace(re, ""), line);
          for (const m of [...cleaned.matchAll(RAW_CLASS), ...cleaned.matchAll(HEX)]) {
            offences.push(`${path.relative(SRC, file)}:${i + 1}  ${m[0]}`);
          }
        });
    }
    expect(offences, offences.join("\n")).toEqual([]);
  });
});
