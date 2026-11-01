import type { ClientSession } from "mongoose";
import { mongoose } from "@/models";

/**
 * Runs `fn` in a MongoDB transaction. The dev database (docker-compose) is a single-node replica
 * set, so transactions are normally available; a standalone server can't run them, and then `fn`
 * runs once without a session so the app still works.
 */
export async function runInTransaction<T>(fn: (session?: ClientSession) => Promise<T>): Promise<{ result: T; transactional: boolean }> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return { result, transactional: true };
  } catch (err) {
    if (/replica set|Transaction numbers/i.test((err as Error).message ?? "")) return { result: await fn(), transactional: false };
    throw err;
  } finally {
    await session.endSession();
  }
}
