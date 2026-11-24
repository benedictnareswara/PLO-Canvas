import { describe, expect, it } from "vitest";
import { LOCK_MS, MAX_FAILURES, WINDOW_MS, createThrottle } from "@/lib/auth/throttle";

describe("sign-in throttle", () => {
  function setup() {
    let t = 0;
    return { clock: { advance: (ms: number) => (t += ms) }, throttle: createThrottle(() => t) };
  }

  it("allows four failures and locks on the fifth", () => {
    const { throttle } = setup();
    for (let i = 0; i < MAX_FAILURES - 1; i++) throttle.fail("a@x.id");
    expect(throttle.lockedFor("a@x.id")).toBe(0);
    throttle.fail("a@x.id");
    expect(throttle.lockedFor("a@x.id")).toBe(LOCK_MS / 60000);
    expect(throttle.lockedFor("b@x.id")).toBe(0);
  });

  it("unlocks after the lock period", () => {
    const { clock, throttle } = setup();
    for (let i = 0; i < MAX_FAILURES; i++) throttle.fail("a@x.id");
    clock.advance(LOCK_MS);
    expect(throttle.lockedFor("a@x.id")).toBe(0);
  });

  it("forgets failures older than the window", () => {
    const { clock, throttle } = setup();
    for (let i = 0; i < MAX_FAILURES - 1; i++) throttle.fail("a@x.id");
    clock.advance(WINDOW_MS);
    throttle.fail("a@x.id");
    expect(throttle.lockedFor("a@x.id")).toBe(0);
  });

  it("a successful sign-in clears the count", () => {
    const { throttle } = setup();
    for (let i = 0; i < MAX_FAILURES - 1; i++) throttle.fail("a@x.id");
    throttle.succeed("a@x.id");
    throttle.fail("a@x.id");
    expect(throttle.lockedFor("a@x.id")).toBe(0);
  });
});
