import { describe, expect, it } from "vitest";

import { parseBigInt, serializeBigInt } from "./bigint";

describe("serializeBigInt", () => {
  it("bigint 단일 값을 문자열로 바꾼다", () => {
    expect(serializeBigInt(1234000n)).toBe("1234000");
    expect(serializeBigInt(-5n)).toBe("-5");
  });

  it("중첩 객체와 배열 안의 bigint를 모두 바꾼다", () => {
    const input = {
      month: "2026-09",
      sales: { product: 120000000n, goods: 3000000n },
      items: [{ amount: 1n }, { amount: 2n }],
    };
    expect(serializeBigInt(input)).toEqual({
      month: "2026-09",
      sales: { product: "120000000", goods: "3000000" },
      items: [{ amount: "1" }, { amount: "2" }],
    });
  });

  it("Date, null, number, boolean은 그대로 둔다", () => {
    const date = new Date("2026-10-01T00:00:00Z");
    const result = serializeBigInt({ date, memo: null, rate: 0.5, done: true });
    expect(result.date).toBe(date);
    expect(result).toEqual({ date, memo: null, rate: 0.5, done: true });
  });

  it("결과는 JSON.stringify가 가능하다", () => {
    const value = { total: 9007199254740993n };
    expect(() => JSON.stringify(value)).toThrow();
    expect(JSON.stringify(serializeBigInt(value))).toBe(
      '{"total":"9007199254740993"}',
    );
  });

  it("원본 객체를 변경하지 않는다", () => {
    const input = { amount: 10n };
    serializeBigInt(input);
    expect(input.amount).toBe(10n);
  });
});

describe("parseBigInt", () => {
  it("직렬화한 값을 되돌린다 (정밀도 손실 없음)", () => {
    expect(parseBigInt(serializeBigInt(9007199254740993n))).toBe(
      9007199254740993n,
    );
    expect(parseBigInt("-42")).toBe(-42n);
  });

  it("정수가 아닌 문자열은 거부한다", () => {
    expect(() => parseBigInt("1.5")).toThrow(TypeError);
    expect(() => parseBigInt("")).toThrow(TypeError);
    expect(() => parseBigInt("abc")).toThrow(TypeError);
  });
});
