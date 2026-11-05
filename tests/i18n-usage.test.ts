import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";

/**
 * Every literal key passed to a translator exists in the English messages. next-intl only reports
 * missing keys at runtime, so this catches typos and forgotten strings at test time. Dynamic keys
 * (template literals) are skipped.
 */
const SRC = path.resolve(import.meta.dirname, "../src");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

function has(key: string): boolean {
  let node: unknown = en;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string";
}

describe("i18n usage", () => {
  it("only uses message keys that exist", () => {
    const missing: string[] = [];
    for (const file of files(SRC)) {
      const src = readFileSync(file, "utf8");
      const translators = [...src.matchAll(/const (\w+) = (?:await )?(?:useTranslations|getTranslations)(?:<[^>]*>)?\((?:"([\w.]+)")?\)/g)];
      // A declaration is in scope until the next declaration of the same name (the next component).
      translators.forEach((decl, i) => {
        const [, name, ns] = decl;
        const end = translators.slice(i + 1).find((d) => d[1] === name)?.index ?? src.length;
        const scope = src.slice(decl.index, end);
        for (const m of scope.matchAll(new RegExp(`\\b${name}(?:\\.rich|\\.markup)?\\(\\s*"([\\w.]+)"`, "g"))) {
          const key = ns ? `${ns}.${m[1]}` : m[1];
          if (!has(key)) missing.push(`${path.relative(SRC, file)}: ${key}`);
        }
      });
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });
});
