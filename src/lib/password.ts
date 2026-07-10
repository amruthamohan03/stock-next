import bcrypt from "bcryptjs";

/**
 * Verify a plaintext password against a bcrypt hash.
 *
 * PHP's password_hash() emits `$2y$` hashes. bcryptjs is happiest with `$2b$`;
 * the two prefixes are the same algorithm, so we normalize before comparing.
 * This lets existing users log in with their current passwords unchanged.
 */
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  const normalized = hash.startsWith("$2y$")
    ? "$2b$" + hash.slice(4)
    : hash;
  try {
    return await bcrypt.compare(plain, normalized);
  } catch {
    return false;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
