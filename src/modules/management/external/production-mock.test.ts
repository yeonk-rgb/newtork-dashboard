import { describe, expect, it } from "vitest";

import {
  getSalesShareByIndustry,
  getSalesShareBySeries,
} from "./production-mock";

const q3 = { unit: "quarter", year: 2026, quarter: 3 } as const;

describe("생산팀 목업", () => {
  it("interface 형식 + source: mock", async () => {
    const result = await getSalesShareByIndustry(q3);
    expect(result.source).toBe("mock");
    expect(result.items.length).toBe(7);
    for (const item of result.items) {
      expect(typeof item.amount).toBe("bigint");
      expect(item.quantity).toBeGreaterThan(0);
    }
  });

  it("금액 내림차순", async () => {
    const { items } = await getSalesShareBySeries(q3);
    const amounts = items.map((i) => i.amount);
    expect([...amounts].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))).toEqual(
      amounts,
    );
    expect(items.every((i) => i.label.includes("목업"))).toBe(true);
  });

  it("같은 기간이면 같은 값 (새로고침해도 그래프가 바뀌지 않음)", async () => {
    expect(await getSalesShareByIndustry(q3)).toEqual(
      await getSalesShareByIndustry(q3),
    );
  });
});

describe("목업 규모", () => {
  it("같은 기간이면 산업분야·시리즈 합계가 비슷하다 (천 원 반올림 차이만)", async () => {
    const sumOf = (items: { amount: bigint }[]) =>
      items.reduce((acc, i) => acc + i.amount, 0n);
    const industry = await getSalesShareByIndustry(q3);
    const series = await getSalesShareBySeries(q3);
    const diff = sumOf(industry.items) - sumOf(series.items);
    expect(diff < 0n ? -diff : diff).toBeLessThan(10_000n);
    // 분기 = 3개월 × 월 2억 ± 10%
    expect(sumOf(industry.items)).toBeGreaterThan(540_000_000n);
    expect(sumOf(industry.items)).toBeLessThan(660_000_000n);
  });
});
