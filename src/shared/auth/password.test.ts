import { describe, expect, it } from "vitest";

import { generateTempPassword, hashPassword, verifyPassword } from "./password";

// 테스트는 빠르게 — 비용을 낮춘 값 (저장 형식에 비용이 들어 있어 검증은 그대로 동작)
const FAST = { N: 1024, r: 8, p: 1 };

describe("hashPassword / verifyPassword", () => {
  it("같은 비밀번호만 통과", async () => {
    const hash = await hashPassword("abc12345", FAST);
    expect(await verifyPassword("abc12345", hash)).toBe(true);
    expect(await verifyPassword("abc12346", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("원문을 저장하지 않고, 같은 비밀번호도 매번 다른 해시 (salt)", async () => {
    const a = await hashPassword("abc12345", FAST);
    const b = await hashPassword("abc12345", FAST);
    expect(a).not.toContain("abc12345");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$1024$8$1$")).toBe(true);
  });

  it("기본 비용(N=2^17)으로도 동작", async () => {
    const hash = await hashPassword("abc12345");
    expect(hash.startsWith(`scrypt$${2 ** 17}$8$1$`)).toBe(true);
    expect(await verifyPassword("abc12345", hash)).toBe(true);
  });

  it("형식이 잘못된 해시는 false (에러 없이)", async () => {
    for (const bad of [
      "",
      "plain",
      "bcrypt$x$y",
      "scrypt$0$8$1$a$b",
      "scrypt$1024$8$1$$",
    ]) {
      expect(await verifyPassword("abc12345", bad)).toBe(false);
    }
  });
});

describe("generateTempPassword", () => {
  it("12자, 영문+숫자 포함, 헷갈리는 글자 없음, 매번 다름", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const pw = generateTempPassword();
      expect(pw).toHaveLength(12);
      expect(pw).toMatch(/[A-Za-z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).not.toMatch(/[0O1lIo]/);
      seen.add(pw);
    }
    expect(seen.size).toBe(200);
  });
});
