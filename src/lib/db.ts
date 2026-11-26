/**
 * Connects the app to MongoDB (the database). Mongoose is the library that talks to it.
 * The address of the database comes from the MONGODB_URI setting in the .env file.
 */
import mongoose from "mongoose";

type Cached = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

// Reuse one connection across hot reloads and route handler invocations.
const globalForMongo = globalThis as unknown as { __mongoose?: Cached };
const cached: Cached = globalForMongo.__mongoose ?? { conn: null, promise: null };
globalForMongo.__mongoose = cached;

/**
 * Gives back the open database connection, opening it the first time it is needed.
 * Later calls reuse the same connection, so the app does not open a new one for every request.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local.");
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}
