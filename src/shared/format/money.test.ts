import { describe, expect, it } from "vitest";

import {
  formatAmount,
  formatWon,
  formatWonCompact,
  formatWonShort,
} from "./money";

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

describe("formatWonCompact", () => {
  it("1억 이상: 소수 첫째 자리 (0이면 생략)", () => {
    expect(formatWonCompact(250_000_000n)).toBe("2.5억");
    expect(formatWonCompact(2_800_000_000n)).toBe("28억");
    expect(formatWonCompact(481_773_000n)).toBe("4.8억");
    expect(formatWonCompact(616_000_000n)).toBe("6.2억");
    expect(formatWonCompact(123_456_789_000n)).toBe("1,234.6억");
  });

  it("1만 이상 1억 미만: 만 단위", () => {
    expect(formatWonCompact(48_170_000n)).toBe("4,817만");
    expect(formatWonCompact(48_174_999n)).toBe("4,817만");
    expect(formatWonCompact(10_000n)).toBe("1만");
  });

  it("만 단위 반올림으로 1억이 되면 억으로", () => {
    expect(formatWonCompact(99_995_000n)).toBe("1억");
  });

  it("1만 미만, 0, 음수, 문자열·number 입력", () => {
    expect(formatWonCompact(9_500n)).toBe("9,500");
    expect(formatWonCompact(0n)).toBe("0");
    expect(formatWonCompact(-250_000_000n)).toBe("-2.5억");
    expect(formatWonCompact("48170000")).toBe("4,817만");
    expect(formatWonCompact(250_000_000)).toBe("2.5억");
  });
});

describe("formatWon", () => {
  it("'원'을 붙인다", () => {
    expect(formatWon(50000n)).toBe("50,000원");
  });
});

describe("formatWonShort", () => {
  it("0원, 1만 원 미만은 원 단위 그대로", () => {
    expect(formatWonShort(0n)).toBe("0원");
    expect(formatWonShort(9_500n)).toBe("9,500원");
    expect(formatWonShort(9_999n)).toBe("9,999원");
  });

  it("1만 원 이상 1억 미만은 만원 (반올림)", () => {
    expect(formatWonShort(10_000n)).toBe("1만원");
    expect(formatWonShort(66_680_000n)).toBe("6,668만원");
    expect(formatWonShort(66_684_999n)).toBe("6,668만원");
    expect(formatWonShort(66_685_000n)).toBe("6,669만원");
  });

  it("1억 이상은 억원 소수 둘째 자리", () => {
    expect(formatWonShort(709_000_000n)).toBe("7.09억원");
    expect(formatWonShort(4_000_000_000n)).toBe("40.00억원");
    expect(formatWonShort(3_620_000_000n)).toBe("36.20억원");
    expect(formatWonShort(708_500_000n)).toBe("7.09억원"); // 0.005억 반올림
    expect(formatWonShort(123_456_789_000_000n)).toBe("1,234,567.89억원");
  });

  it("정확히 1억, 반올림으로 1억이 되는 경우", () => {
    expect(formatWonShort(100_000_000n)).toBe("1.00억원");
    expect(formatWonShort(99_999_999n)).toBe("1.00억원");
    expect(formatWonShort(99_994_999n)).toBe("9,999만원");
  });

  it("음수 (목표 초과분·적자 등)", () => {
    expect(formatWonShort(-123_000_000n)).toBe("-1.23억원");
    expect(formatWonShort(-66_680_000n)).toBe("-6,668만원");
    expect(formatWonShort(-9_500n)).toBe("-9,500원");
  });

  it("직렬화된 정수 문자열·number 도 받는다", () => {
    expect(formatWonShort("481773000")).toBe("4.82억원");
    expect(formatWonShort(10_000)).toBe("1만원");
  });
});
