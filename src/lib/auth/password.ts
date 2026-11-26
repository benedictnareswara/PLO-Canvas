/**
 * Password safety. Passwords are never saved as typed. bcrypt scrambles them into a "hash" that
 * cannot be turned back into the password, so even someone who reads the database cannot see them.
 */
import bcrypt from "bcryptjs";

/** Scrambles a password for saving. The 10 is how much work bcrypt does; more is safer but slower. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** Checks a typed password against a saved hash. Gives true when they match. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
