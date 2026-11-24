import type { ClientSession } from "mongoose";
import { HttpError } from "@/lib/auth/rbac";
import { mongoose } from "@/models";

/**
 * Runs `fn` in a MongoDB transaction: every write in it lands, or none does (NFR-03). The database
 * must be a replica set; the Docker setup (docker compose up) starts a single-node one. A
 * standalone server is refused with a clear message instead of half-saving.
 */
export async function runInTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<{ result: T }> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return { result };
  } catch (err) {
    if (/replica set|Transaction numbers/i.test((err as Error).message ?? "")) {
      throw new HttpError(503, "The database must run as a replica set for changes to be saved safely. Start it with docker compose up.");
    }
    throw err;
  } finally {
    await session.endSession();
  }
}
