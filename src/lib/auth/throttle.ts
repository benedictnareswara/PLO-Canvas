/**
 * Sign-in throttling: after MAX_FAILURES wrong passwords for one email within WINDOW_MS, that
 * email is locked for LOCK_MS. A successful sign-in clears it. Kept in memory: the app runs as one
 * server process, and a restart clearing the counters is acceptable.
 */
export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;

interface Entry {
  failures: number[];
  lockedUntil: number;
}

export function createThrottle(now: () => number = Date.now) {
  const entries = new Map<string, Entry>();
  return {
    /** Minutes left on a lock, or 0 when the email may try. */
    lockedFor(email: string): number {
      const e = entries.get(email);
      const left = e ? e.lockedUntil - now() : 0;
      return left > 0 ? Math.ceil(left / 60000) : 0;
    },
    fail(email: string) {
      const t = now();
      const e = entries.get(email) ?? { failures: [], lockedUntil: 0 };
      e.failures = [...e.failures.filter((f) => t - f < WINDOW_MS), t];
      if (e.failures.length >= MAX_FAILURES) {
        e.lockedUntil = t + LOCK_MS;
        e.failures = [];
      }
      entries.set(email, e);
      // Keep the map small: drop entries with nothing left to remember.
      if (entries.size > 10000) for (const [k, v] of entries) if (v.lockedUntil < t && !v.failures.length) entries.delete(k);
    },
    succeed(email: string) {
      entries.delete(email);
    },
  };
}

export const loginThrottle = createThrottle();
