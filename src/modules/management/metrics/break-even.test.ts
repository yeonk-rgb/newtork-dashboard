// 손익분기점(BEP) — 분류, 계산식(BigInt), 예외, 기간 합산, 임시저장 달, 이익 구조와 흑자·적자 일치
import { describe, expect, it } from "vitest";

import { breakEvenItems, computeBreakEven } from "./break-even";
import { DEFAULT_METRICS_SETTINGS, type MetricsSettings } from "./settings";
import { computeManagementSummary } from "./summary";
import { date, financeMonth } from "./test-fixtures";
import type { FinanceMonth, OtherExpenseInput } from "./types";

const BEP = DEFAULT_METRICS_SETTINGS.breakEven;
const other = (
  name: string,
  costType: OtherExpenseInput["costType"],
  amount: bigint,
  sortOrder = 1,
): OtherExpenseInput => ({
  categoryId: `c-${name}`,
  name,
  sortOrder,
  costType,
  amount,
});

/** 매출(제품) · 매입(원재료) · 경비 로 한 달 */
const month = (
  m: number,
  sales: bigint,
  variable: bigint,
  fixed: bigint,
  extra: Partial<FinanceMonth> = {},
) =>
  financeMonth(2026, m, {
    productSales: sales,
    materialPurchase: variable,
    operatingExpense: fixed,
    ...extra,
  });

const bep = (months: FinanceMonth[]) =>
  computeBreakEven(
    months,
    months.reduce(
      (n, m) => n + m.productSales + m.goodsSales + m.serviceSales,
      0n,
    ),
    "purchases",
    BEP,
  );

describe("분류 (임시 기준)", () => {
  it("매입은 변동비, 경비는 고정비, 그 외 지출은 항목 설정, 미분류는 고정비", () => {
    const items = breakEvenItems(
      [
        financeMonth(2026, 9, {
          goodsPurchase: 1n,
          materialPurchase: 2n,
          operatingExpense: 3n,
          otherExpenses: [
            other("광고선전비", "VARIABLE", 4n, 1),
            other("복리후생비", "FIXED", 5n, 2),
            other("지급수수료", null, 6n, 3),
          ],
        }),
      ],
      "purchases",
      BEP,
    );
    expect(items.map((i) => [i.label, i.costClass, i.basis])).toEqual([
      ["상품 매입", "VARIABLE", "provisional"],
      ["원재료 매입", "VARIABLE", "provisional"],
      ["경비 지출", "FIXED", "provisional"],
      ["광고선전비", "VARIABLE", "category"],
      ["복리후생비", "FIXED", "category"],
      ["지급수수료", "FIXED", "unclassified"],
    ]);
  });

  it("미분류 개수는 금액이 있는 항목만", () => {
    const r = bep([
      month(9, 100n, 10n, 10n, {
        otherExpenses: [
          other("지급수수료", null, 5n),
          other("잡비", null, 0n, 2),
        ],
      }),
    ]);
    expect(r.unclassifiedCount).toBe(1);
  });

  it("설정을 바꾸면 분류가 바뀐다 (답변 후 전환: 경비 → 변동비)", () => {
    const r = computeBreakEven([month(9, 100n, 10n, 30n)], 100n, "purchases", {
      ...BEP,
      operatingExpense: "VARIABLE",
    });
    expect(r).toMatchObject({ variableCost: 40n, fixedCost: 0n });
  });
});

describe("계산식", () => {
  it("매출 1억·변동비 6천만·고정비 3천만 → 공헌이익률 40%, BEP 7,500만, 달성률 133.3%", () => {
    const r = bep([month(9, 100_000_000n, 60_000_000n, 30_000_000n)]);
    expect(r).toMatchObject({
      contribution: 40_000_000n,
      contributionRatio: 0.4,
      bepRevenue: 75_000_000n,
      gap: 25_000_000n,
      reason: null,
    });
    expect(r.rate).toBeCloseTo(4 / 3, 10);
  });

  it("정확히 손익분기점이면 100%, 남은 매출 0", () => {
    const r = bep([month(9, 100n, 60n, 40n)]);
    expect(r).toMatchObject({ rate: 1, bepRevenue: 100n, gap: 0n });
  });

  it("BEP 매출은 원 단위 올림, 억 단위도 정수 그대로", () => {
    // 고정비 10 × 매출 100 ÷ 공헌이익 30 = 33.33… → 34
    const r = bep([month(9, 100n, 70n, 10n)]);
    expect(r.bepRevenue).toBe(34n);
    const big = bep([
      month(9, 90_000_000_000n, 54_000_000_000n, 27_000_000_000n),
    ]);
    expect(big.bepRevenue).toBe(67_500_000_000n);
  });

  it("100% 미만이면 남은 매출(음수 gap)", () => {
    const r = bep([month(9, 50_000_000n, 30_000_000n, 30_000_000n)]);
    expect(r.bepRevenue).toBe(75_000_000n);
    expect(r.gap).toBe(-25_000_000n);
    expect(r.rate).toBeCloseTo(2 / 3, 10);
  });
});

describe("예외", () => {
  it("확정된 달 없음", () => {
    expect(bep([]).reason).toBe("no-data");
  });
  it("매출 0원", () => {
    expect(bep([month(9, 0n, 0n, 10n)])).toMatchObject({
      reason: "no-revenue",
      rate: null,
      bepRevenue: null,
    });
  });
  it.each([
    ["변동비 = 매출", 100n],
    ["변동비 > 매출", 120n],
  ])("공헌이익 ≤ 0 (%s) → 도달 불가", (_n, variable) => {
    expect(bep([month(9, 100n, variable, 10n)])).toMatchObject({
      reason: "not-reachable",
      rate: null,
    });
  });
  it("고정비 0원", () => {
    expect(bep([month(9, 100n, 50n, 0n)])).toMatchObject({
      reason: "no-fixed-cost",
      rate: null,
    });
  });
});

describe("기간", () => {
  const settings: MetricsSettings = DEFAULT_METRICS_SETTINGS;
  const summary = (
    period: Parameters<typeof computeManagementSummary>[0]["period"],
    months: FinanceMonth[],
  ) =>
    computeManagementSummary({
      period,
      financeMonths: months,
      annualTarget: null,
      receivables: [],
      today: date("2026-10-25"),
      settings,
    }).breakEven;

  it("분기는 월별 달성률의 평균이 아니라 합계로 다시 계산 (250%·37.5% → 108.3%)", () => {
    const months = [month(7, 100n, 50n, 20n), month(8, 20n, 5n, 40n)];
    expect(bep([months[0]]).rate).toBe(2.5);
    expect(bep([months[1]]).rate).toBe(0.375);
    const q = summary({ unit: "quarter", year: 2026, quarter: 3 }, months);
    expect(q.rate).toBeCloseTo(65 / 60, 10); // 평균이면 1.4375
  });

  it("연간·누적도 같은 방식", () => {
    const months = [month(1, 100n, 50n, 20n), month(5, 20n, 5n, 40n)];
    for (const period of [
      { unit: "year", year: 2026 },
      { unit: "ytd", year: 2026, month: 9 },
    ] as const) {
      expect(summary(period, months).rate).toBeCloseTo(65 / 60, 10);
    }
  });

  it("임시저장·미입력 달은 빠진다 (그 달 금액을 바꿔도 결과 같음)", () => {
    const confirmed = month(7, 100n, 50n, 20n);
    const a = summary({ unit: "quarter", year: 2026, quarter: 3 }, [
      confirmed,
      month(8, 1n, 0n, 999n, { status: "DRAFT" }),
    ]);
    const b = summary({ unit: "quarter", year: 2026, quarter: 3 }, [
      confirmed,
      month(8, 5_000n, 9_000n, 1n, { status: "DRAFT" }),
    ]);
    expect(a.rate).toBe(2.5);
    expect(b).toEqual(a);
  });
});

describe("이익 구조와 흑자·적자 판정이 항상 같다", () => {
  const cases: [string, FinanceMonth][] = [
    ["흑자", month(9, 100n, 40n, 30n)],
    ["손익분기", month(9, 100n, 60n, 40n)],
    ["적자", month(9, 100n, 70n, 40n)],
    ["도달 불가", month(9, 100n, 120n, 10n)],
    [
      "그 외 지출 섞임",
      financeMonth(2026, 9, {
        productSales: 1_000n,
        goodsSales: 200n,
        goodsPurchase: 300n,
        materialPurchase: 100n,
        operatingExpense: 400n,
        otherExpenses: [
          other("광고선전비", "VARIABLE", 150n),
          other("지급수수료", null, 260n, 2),
        ],
      }),
    ],
  ];
  it.each(cases)("%s", (_name, m) => {
    for (const costMode of ["purchases", "excludePurchases"] as const) {
      const s = computeManagementSummary({
        period: { unit: "month", year: 2026, month: 9 },
        financeMonths: [m],
        annualTarget: null,
        receivables: [],
        today: date("2026-10-25"),
        settings: { ...DEFAULT_METRICS_SETTINGS, costMode },
      });
      const { breakEven, profit } = s;
      // 변동비 + 고정비 = 이익 계산 비용
      expect(breakEven.variableCost + breakEven.fixedCost).toBe(profit.cost);
      const profitable = profit.profit >= 0n;
      if (breakEven.rate !== null) {
        expect(breakEven.rate >= 1).toBe(profitable);
      } else {
        expect(breakEven.reason).toBe("not-reachable");
        expect(profitable).toBe(false);
      }
    }
  });
});
