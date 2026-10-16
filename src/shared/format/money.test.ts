import { describe, expect, it } from "vitest";

import { formatAmount, formatWon } from "./money";

describe("formatAmount", () => {
  it("천 단위 콤마를 넣는다", () => {
    expect(formatAmount(1234000n)).toBe("1,234,000");
    expect(formatAmount(1234000)).toBe("1,234,000");
    expect(formatAmount("1234000")).toBe("1,234,000");
  });

  it("0과 음수를 처리한다", () => {
    expect(formatAmount(0n)).toBe("0");
    expect(formatAmount(-1500000n)).toBe("-1,500,000");
    expect(formatAmount("-1500000")).toBe("-1,500,000");
  });

  it("Int 범위(약 21억)를 넘는 BigInt도 정확히 표시한다", () => {
    expect(formatAmount(12345678901234n)).toBe("12,345,678,901,234");
    expect(formatAmount("9007199254740993")).toBe("9,007,199,254,740,993");
  });

  it("number 소수는 원 단위로 반올림한다", () => {
    expect(formatAmount(1234.6)).toBe("1,235");
  });

  it("정수가 아닌 문자열과 NaN은 거부한다", () => {
    expect(() => formatAmount("12.5")).toThrow(TypeError);
    expect(() => formatAmount("1,000")).toThrow(TypeError);
    expect(() => formatAmount(Number.NaN)).toThrow(TypeError);
  });
});

describe("formatWon", () => {
  it("'원'을 붙인다", () => {
    expect(formatWon(50000n)).toBe("50,000원");
  });
});
