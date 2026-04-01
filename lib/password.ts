import crypto from "crypto";

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function scryptBuffer(password: string, salt: string, keyLength: number, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      keyLength,
      {
        N: n,
        r,
        p,
        maxmem: 128 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey as Buffer);
      }
    );
  });
}

function timingSafeHexEqual(leftHex: string, rightHex: string) {
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function validatePasswordStrength(password: string) {
  const trimmed = password.trim();
  return trimmed.length >= 12;
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptBuffer(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_N, SCRYPT_R, SCRYPT_P);

  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt,
    derived.toString("hex"),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, nRaw, rRaw, pRaw, salt, expectedHash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !nRaw || !rRaw || !pRaw || !salt || !expectedHash) return false;

  const derived = await scryptBuffer(
    password,
    salt,
    expectedHash.length / 2,
    Number(nRaw),
    Number(rRaw),
    Number(pRaw)
  );

  return timingSafeHexEqual(derived.toString("hex"), expectedHash);
}
