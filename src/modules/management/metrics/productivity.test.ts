// 인당 생산성 — 확정된 달 합계 ÷ 직원 수 (원 단위 반올림)
import { describe, expect, it } from "vitest";

import { computeProductivity } from "./productivity";

const core = (revenue: bigint, profit: bigint, hasData = true) =>
  ({
    confirmation: { hasData },
    revenue: { total: revenue },
    profit: { profit },
  }) as Parameters<typeof computeProductivity>[0];

describe("인당 생산성", () => {
  it("매출 ÷ 인원, 추정 이익 ÷ 인원 (원 단위 반올림)", () => {
    expect(computeProductivity(core(1_000_000_000n, 100_000_001n), 12)).toEqual(
      {
        headcount: 12,
        revenuePerHead: 83_333_333n, // 83,333,333.33
        profitPerHead: 8_333_333n, // 8,333,333.42
        reason: null,
      },
    );
    expect(computeProductivity(core(5n, 0n), 2).revenuePerHead).toBe(3n); // 2.5 → 3
  });

  it("적자면 1인당 이익도 음수 (0에서 먼 쪽 반올림, 대칭)", () => {
    expect(computeProductivity(core(10n, -5n), 2).profitPerHead).toBe(-3n);
    expect(computeProductivity(core(10n, -7n), 3).profitPerHead).toBe(-2n);
  });

  it("직원 수가 없거나 0 이하면 no-headcount", () => {
    for (const h of [null, undefined, 0]) {
      expect(computeProductivity(core(100n, 10n), h)).toMatchObject({
        headcount: null,
        revenuePerHead: null,
        reason: "no-headcount",
      });
    }
  });

  it("확정된 달이 없으면 no-data (직원 수는 보여 줌)", () => {
    expect(computeProductivity(core(0n, 0n, false), 12)).toEqual({
      headcount: 12,
      revenuePerHead: null,
      profitPerHead: null,
      reason: "no-data",
    });
  });
});
