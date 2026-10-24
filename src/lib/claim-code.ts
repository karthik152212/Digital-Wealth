import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const MAX_CLAIM_CODE_ATTEMPTS = 5;

const CODE_BYTES = 12;
const SALT_BYTES = 16;
const KEY_LENGTH = 32;

export function generateClaimCode(): string {
  return randomBytes(CODE_BYTES).toString("base64url");
}

export function hashClaimCode(code: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(code, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyClaimCode(code: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(code, Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
