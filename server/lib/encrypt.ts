/**
 * Encryption utility for sensitive values (e.g. QuickBooks credentials).
 * Uses AES-256-GCM. Key from QUICKBOOKS_ENCRYPTION_KEY or ENCRYPTION_KEY env (32 bytes or any length, hashed to 32).
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const secret =
    process.env.QUICKBOOKS_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "QUICKBOOKS_ENCRYPTION_KEY, ENCRYPTION_KEY, or SESSION_SECRET (min 16 chars) must be set for credential encryption"
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypt a plaintext string. Returns a hex string of iv + tag + ciphertext (decode with decrypt).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("hex");
}

/**
 * Decrypt a value produced by encrypt().
 */
export function decrypt(hexPayload: string): string {
  const key = getKey();
  const buf = Buffer.from(hexPayload, "hex");
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
