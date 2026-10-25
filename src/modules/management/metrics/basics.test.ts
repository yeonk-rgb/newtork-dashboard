// 비율·증감률, 확정 월 선택, 매출·지출·이익
import { describe, expect, it } from "vitest";

import { selectConfirmed } from "./confirmation";
import { computeExpenses } from "./expenses";
import { changeRate, ratio } from "./math";
import { computeProfit } from "./profit";
import { computeRevenue } from "./revenue";
import { date, financeMonth } from "./test-fixtures";

describe("ratio / changeRate", () => {
  it("0으로 나누면 null", () => {
    expect(ratio(10n, 0n)).toBeNull();
    expect(ratio(1n, 4n)).toBe(0.25);
  });

  it("증감률: 기본, 비교 데이터 없음, 비교값 0, 음수 기준", () => {
    expect(changeRate(120n, 100n)).toEqual({ rate: 0.2 });
    expect(changeRate(80n, 100n)).toEqual({ rate: -0.2 });
    expect(changeRate(100n, null)).toEqual({ rate: null, reason: "no-data" });
    expect(changeRate(100n, 0n)).toEqual({ rate: null, reason: "zero-base" });
    // 적자 −100 → 흑자 +50 은 +150% 개선
    expect(changeRate(50n, -100n)).toEqual({ rate: 1.5 });
  });
});

describe("selectConfirmed", () => {
  const today = date("2026-10-16");
  const q3 = { unit: "quarter", year: 2026, quarter: 3 } as const;

  it("CONFIRMED만 집계, DRAFT·없는 달은 미확정 목록", () => {
    const months = [
      financeMonth(2026, 7),
      financeMonth(2026, 9, { status: "DRAFT" }),
    ];
    const { confirmed, confirmation } = selectConfirmed(q3, months, today);
    expect(confirmed.map((m) => m.month)).toEqual([7]);
    expect(confirmation.unconfirmedMonths).toEqual([
      { year: 2026, month: 8, reason: "MISSING" },
      { year: 2026, month: 9, reason: "DRAFT" },
    ]);
    expect(confirmation.isPartial).toBe(true);
    expect(confirmation.hasData).toBe(true);
  });

  it("이번 달·미래 월은 미확정이 아니라 마감 전(pending)", () => {
    const q4 = { unit: "quarter", year: 2026, quarter: 4 } as const;
    const { confirmation } = selectConfirmed(q4, [], today);
    expect(confirmation.pendingMonths.map((m) => m.month)).toEqual([
      10, 11, 12,
    ]);
    expect(confirmation.unconfirmedMonths).toEqual([]);
    expect(confirmation.isPartial).toBe(false);
    expect(confirmation.hasData).toBe(false);
  });
});

describe("매출·지출·이익", () => {
  const months = [
    financeMonth(2026, 7, {
      productSales: 600n,
      goodsSales: 300n,
      serviceSales: 100n,
      goodsPurchase: 200n,
      materialPurchase: 100n,
      operatingExpense: 150n,
      otherExpenses: [
        {
          categoryId: "c2",
          name: "접대비",
          sortOrder: 2,
          costType: "VARIABLE",
          amount: 20n,
        },
        {
          categoryId: "c1",
          name: "광고선전비",
          sortOrder: 1,
          costType: "VARIABLE",
          amount: 30n,
        },
      ],
    }),
    financeMonth(2026, 8, {
      productSales: 400n,
      otherExpenses: [
        {
          categoryId: "c1",
          name: "광고선전비",
          sortOrder: 1,
          costType: "VARIABLE",
          amount: 50n,
        },
      ],
    }),
  ];

  it("총매출과 구성 비율", () => {
    const revenue = computeRevenue(months);
    expect(revenue.total).toBe(1400n);
    expect(revenue.items.map((i) => [i.key, i.amount, i.ratio])).toEqual([
      ["product", 1000n, 1000 / 1400],
      ["goods", 300n, 300 / 1400],
      ["service", 100n, 100 / 1400],
    ]);
  });

  it("총지출, 항목별 비중, 그 외 지출은 항목별로 합산·정렬", () => {
    const expenses = computeExpenses(months);
    expect(expenses.total).toBe(200n + 100n + 150n + 100n);
    expect(expenses.items.find((i) => i.key === "otherExpense")?.amount).toBe(
      100n,
    );
    expect(expenses.otherItems.map((i) => [i.label, i.amount])).toEqual([
      ["광고선전비", 80n],
      ["접대비", 20n],
    ]);
    expect(expenses.otherItems[0].ratio).toBe(80 / 550);
  });

  it("이익: 매입 포함(기본) / 매입 제외(참고)", () => {
    const revenue = computeRevenue(months);
    const expenses = computeExpenses(months);
    const withPurchases = computeProfit(revenue, expenses, "purchases");
    expect(withPurchases).toEqual({
      costMode: "purchases",
      cost: 550n,
      profit: 850n,
      margin: 850 / 1400,
    });
    const excluded = computeProfit(revenue, expenses, "excludePurchases");
    expect(excluded.cost).toBe(250n);
    expect(excluded.profit).toBe(1150n);
  });

  it("데이터 없음: 모두 0, 비율은 null", () => {
    const revenue = computeRevenue([]);
    const expenses = computeExpenses([]);
    expect(revenue.total).toBe(0n);
    expect(revenue.items.every((i) => i.ratio === null)).toBe(true);
    expect(expenses.otherItems).toEqual([]);
    expect(computeProfit(revenue, expenses, "purchases").margin).toBeNull();
  });
});
