// 비밀번호 해시·검증·임시 비밀번호 — Node 내장 crypto(scrypt)만 쓴다 (외부 패키지 없음)
// 저장 형식: scrypt$N$r$p$salt(base64)$hash(base64) — 나중에 비용을 올려도 옛 해시를 그대로 검증할 수 있다
import {
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

export type ScryptParams = { N: number; r: number; p: number };

/** OWASP 권장값 (N=2^17, r=8, p=1) — 1회 약 0.3초, 메모리 128MB */
export const DEFAULT_SCRYPT: ScryptParams = { N: 2 ** 17, r: 8, p: 1 };

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function scrypt(
  password: string,
  salt: Buffer,
  { N, r, p }: ScryptParams,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // maxmem: 기본 32MB로는 N=2^17이 거절되므로 필요한 만큼(128·N·r) + 여유
    const maxmem = 128 * N * r * 2;
    scryptCallback(
      password.normalize("NFC"),
      salt,
      KEY_LENGTH,
      { N, r, p, maxmem },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(
  password: string,
  params: ScryptParams = DEFAULT_SCRYPT,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(password, salt, params);
  return [
    "scrypt",
    params.N,
    params.r,
    params.p,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

function parseHash(stored: string) {
  const [scheme, N, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return null;
  const params = { N: Number(N), r: Number(r), p: Number(p) };
  if (!Object.values(params).every((v) => Number.isInteger(v) && v > 0)) {
    return null;
  }
  return {
    params,
    salt: Buffer.from(salt, "base64"),
    hash: Buffer.from(hash, "base64"),
  };
}

/** 저장된 해시와 비교 (형식이 잘못된 해시는 false) — 비교는 시간 일정 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  const actual = await scrypt(password, parsed.salt, parsed.params);
  return (
    actual.length === parsed.hash.length && timingSafeEqual(actual, parsed.hash)
  );
}

// 헷갈리는 글자(0·O·o, 1·l·I) 제외
const LETTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

/** 임시 비밀번호 (12자, 영문+숫자 모두 포함) — 관리자 화면·시드에서 한 번만 보여준다 */
export function generateTempPassword(length = 12): string {
  const all = LETTERS + DIGITS;
  const chars = [
    LETTERS[randomInt(LETTERS.length)],
    DIGITS[randomInt(DIGITS.length)],
    ...Array.from({ length: length - 2 }, () => all[randomInt(all.length)]),
  ];
  // 첫 두 글자 위치를 섞는다 (Fisher–Yates)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
