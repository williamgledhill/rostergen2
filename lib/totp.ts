import crypto from "crypto";

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_BYTES = 5;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEV_ENCRYPTION_KEY_SALT = "roster-dev-encryption-key";

function getEncryptionKey() {
  const configured = process.env.APP_ENCRYPTION_KEY?.trim();
  if (configured) {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32) return decoded;
  }

  if (process.env.NODE_ENV !== "production") {
    const base = process.env.SESSION_SECRET?.trim() || DEV_ENCRYPTION_KEY_SALT;
    return crypto.createHash("sha256").update(base).digest();
  }

  throw new Error("APP_ENCRYPTION_KEY must be a base64-encoded 32 byte key in production.");
}

function normalizeBase32(input: string) {
  return input.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

export function encodeBase32(input: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function decodeBase32(input: string) {
  const normalized = normalizeBase32(input);
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

export function createTotpSecret() {
  const secretBytes = crypto.randomBytes(20);
  return {
    secret: encodeBase32(secretBytes),
    bytes: secretBytes,
  };
}

function totpAtCounter(secretBytes: Buffer, counter: number) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", secretBytes).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function buildOtpAuthUri(email: string, secret: string) {
  const issuer = "Roster Planner";
  const label = `${issuer}:${email}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function verifyTotpCode(secret: string, code: string, nowMs = Date.now()) {
  const normalizedCode = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalizedCode)) return false;

  const secretBytes = decodeBase32(secret);
  const currentCounter = Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
  for (let delta = -1; delta <= 1; delta += 1) {
    if (totpAtCounter(secretBytes, currentCounter + delta) === normalizedCode) {
      return true;
    }
  }
  return false;
}

export function encryptSecret(secret: string) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    nonce: nonce.toString("base64url"),
    ciphertext: Buffer.concat([ciphertext, authTag]).toString("base64url"),
  };
}

export function decryptSecret(ciphertext: string, nonce: string) {
  const payload = Buffer.from(ciphertext, "base64url");
  const iv = Buffer.from(nonce, "base64url");
  const authTag = payload.subarray(payload.length - 16);
  const encrypted = payload.subarray(0, payload.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf-8");
}

export function generateRecoveryCodes() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    encodeBase32(crypto.randomBytes(RECOVERY_CODE_BYTES)).slice(0, 8)
  );
}

export function normalizeRecoveryCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

export function hashRecoveryCode(code: string) {
  return crypto.createHash("sha256").update(normalizeRecoveryCode(code)).digest("base64url");
}

export function matchesRecoveryCode(code: string, hashedCodes: string[]) {
  const candidate = hashRecoveryCode(code);
  const index = hashedCodes.findIndex((hashed) => hashed === candidate);
  if (index === -1) return { matched: false as const, nextHashedCodes: hashedCodes };

  return {
    matched: true as const,
    nextHashedCodes: hashedCodes.filter((_, hashedIndex) => hashedIndex !== index),
  };
}
