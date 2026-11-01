import { describe, expect, it } from "vitest";
import { formatHotkey, matchesHotkey, parseHotkey } from "@/lib/hooks/useHotkeys";

function key(init: Partial<KeyboardEvent>): KeyboardEvent {
  return { key: "", code: "", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...init } as KeyboardEvent;
}

describe("hotkeys", () => {
  it("parses modifiers and key", () => {
    expect(parseHotkey("mod+shift+K")).toEqual({ mod: true, shift: true, alt: false, key: "k" });
  });

  it("maps mod to ⌘ on Apple platforms and Ctrl elsewhere", () => {
    const save = parseHotkey("mod+s");
    expect(matchesHotkey(key({ key: "s", code: "KeyS", metaKey: true }), save, true)).toBe(true);
    expect(matchesHotkey(key({ key: "s", code: "KeyS", ctrlKey: true }), save, true)).toBe(false);
    expect(matchesHotkey(key({ key: "s", code: "KeyS", ctrlKey: true }), save, false)).toBe(true);
  });

  it("does not fire when extra modifiers are held", () => {
    expect(matchesHotkey(key({ key: "S", code: "KeyS", metaKey: true, shiftKey: true }), parseHotkey("mod+s"), true)).toBe(false);
  });

  it("matches Option combos on macOS by physical key", () => {
    // Option+H types "˙" on a US Mac layout.
    expect(matchesHotkey(key({ key: "˙", code: "KeyH", altKey: true }), parseHotkey("alt+h"), true)).toBe(true);
  });

  it("formats for display", () => {
    expect(formatHotkey("mod+s", true)).toBe("⌘S");
    expect(formatHotkey("mod+s", false)).toBe("Ctrl+S");
    expect(formatHotkey("mod+shift+k", false)).toBe("Ctrl+Shift+K");
  });
});
