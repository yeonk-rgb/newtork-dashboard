import { describe, expect, it } from "vitest";

import { date, financeMonth } from "./test-fixtures";
import { computeTrend, trendRange } from "./trend";

const today = date("2026-10-16");
const q3 = { unit: "quarter", year: 2026, quarter: 3 } as const;

describe("trendRange", () => {
  it("기간 끝에서 거꾸로 12개월, 연도 넘김", () => {
    const range = trendRange(q3);
    expect(range).toHaveLength(12);
    expect(range[0]).toEqual({ year: 2025, month: 10 });
    expect(range.at(-1)).toEqual({ year: 2026, month: 9 });
  });
});

describe("computeTrend", () => {
  const months = [
    financeMonth(2026, 7, {
      productSales: 600n,
      goodsSales: 300n,
      serviceSales: 100n,
      operatingExpense: 400n,
    }),
    financeMonth(2026, 9, {
      productSales: 500n,
      operatingExpense: 100n,
      status: "DRAFT",
    }),
  ];

  it("확정 월: 매출·지출·이익·이익률·구성", () => {
    const july = computeTrend(q3, months, today, "purchases").find(
      (p) => p.month === 7 && p.year === 2026,
    );
    expect(july).toEqual({
      year: 2026,
      month: 7,
      status: "CONFIRMED",
      revenue: 1000n,
      expense: 400n,
      profit: 600n,
      margin: 0.6,
      product: 600n,
      goods: 300n,
      service: 100n,
    });
  });

  it("미확정(DRAFT) 월은 빼지 않고 값 + 상태", () => {
    const sep = computeTrend(q3, months, today, "purchases").at(-1)!;
    expect(sep).toMatchObject({
      month: 9,
      status: "DRAFT",
      revenue: 500n,
      margin: 0.8,
    });
  });

  it("데이터 없는 달은 null (0으로 그리지 않음), 마감 전 달은 PENDING", () => {
    const trend = computeTrend(q3, months, today, "purchases");
    const aug = trend.find((p) => p.month === 8 && p.year === 2026)!;
    expect(aug.status).toBe("MISSING");
    expect(aug.revenue).toBeNull();
    expect(aug.margin).toBeNull();

    const q4 = computeTrend(
      { unit: "quarter", year: 2026, quarter: 4 },
      [],
      today,
      "purchases",
    );
    expect(q4.slice(-3).map((p) => p.status)).toEqual([
      "PENDING",
      "PENDING",
      "PENDING",
    ]);
  });
});
