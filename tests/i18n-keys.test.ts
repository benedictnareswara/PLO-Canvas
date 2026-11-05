import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import id from "../messages/id.json";

type Messages = { [key: string]: string | Messages };

function flatten(obj: Messages, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out.set(prefix + k, v);
    else for (const [kk, vv] of flatten(v, `${prefix}${k}.`)) out.set(kk, vv);
  }
  return out;
}

/** Top-level ICU argument names, e.g. "{count, plural, …}" and "{name}" → ["count", "name"]. */
function placeholders(message: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    if (message[i] === "{") {
      if (depth === 0) {
        const m = message.slice(i + 1).match(/^\s*(\w+)/);
        if (m) names.add(m[1]);
      }
      depth++;
    } else if (message[i] === "}") depth--;
  }
  return [...names].sort();
}

describe("i18n messages", () => {
  const enMap = flatten(en);
  const idMap = flatten(id);

  it("have the same keys in English and Bahasa Indonesia", () => {
    expect([...idMap.keys()].sort()).toEqual([...enMap.keys()].sort());
  });

  it("have no empty values", () => {
    const empty = [...enMap, ...idMap].filter(([, v]) => v.trim() === "").map(([k]) => k);
    expect(empty).toEqual([]);
  });

  // A translation may leave out an argument (Indonesian has no plural forms, so it often drops
  // `count`), but it must never use one the code doesn't pass: that would throw at runtime.
  it("use only placeholders that the English message provides", () => {
    const unknown = [...idMap]
      .filter(([k, v]) => enMap.has(k) && placeholders(v).some((p) => !placeholders(enMap.get(k)!).includes(p)))
      .map(([k]) => k);
    expect(unknown).toEqual([]);
  });
});
