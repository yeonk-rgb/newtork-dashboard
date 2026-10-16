import { describe, expect, it } from "vitest";

import { computeManagementSummary } from "./summary";
import { date, financeMonth, receivable } from "./test-fixtures";

const today = date("2026-10-16");
const sales = (amount: bigint) => ({
  productSales: amount,
  operatingExpense: amount / 2n,
});

describe("computeManagementSummary", () => {
  const months = [
    // 2025 3분기 (전년 동기)
    financeMonth(2025, 7, sales(100n)),
    financeMonth(2025, 8, sales(100n)),
    financeMonth(2025, 9, sales(100n)),
    // 2026 2분기 (직전 분기)
    financeMonth(2026, 4, sales(200n)),
    financeMonth(2026, 5, sales(200n)),
    financeMonth(2026, 6, sales(200n)),
    // 2026 3분기: 9월 DRAFT
    financeMonth(2026, 7, sales(300n)),
    financeMonth(2026, 8, sales(300n)),
    financeMonth(2026, 9, { ...sales(999n), status: "DRAFT" }),
  ];

  const summary = computeManagementSummary({
    period: { unit: "quarter", year: 2026, quarter: 3 },
    financeMonths: months,
    annualTarget: {
      year: 2026,
      revenueTarget: 4_000n,
      quarterTargets: [null, null, null, null],
    },
    receivables: [
      receivable("r", { occurredOn: date("2026-09-01"), amount: 70n }),
    ],
    today,
  });

  it("확정 월만 집계 + 미확정 월 안내", () => {
    expect(summary.revenue.total).toBe(600n);
    expect(summary.confirmation.unconfirmedMonths).toEqual([
      { year: 2026, month: 9, reason: "DRAFT" },
    ]);
    expect(summary.confirmation.isPartial).toBe(true);
  });

  it("직전 분기·전년 동기 대비 (미확정 포함이면 isPartial)", () => {
    expect(summary.changes.previous).toMatchObject({
      label: "2026년 2분기",
      isPartial: true,
      revenue: { rate: 0 }, // 600 vs 600
    });
    expect(summary.changes.lastYear).toMatchObject({
      label: "2025년 3분기",
      revenue: { rate: 1 }, // 600 vs 300 → +100%
    });
  });

  it("이익률은 %p 차이로 비교", () => {
    // 이익 = 매출 − 경비(매출/2) → 이익률 50% 로 같음
    expect(summary.changes.previous.margin).toEqual({ diff: 0 });
    expect(summary.changes.lastYear.margin).toEqual({ diff: 0 });
  });

  it("현재 기간에 확정 데이터가 없으면 −100%가 아니라 no-current-data", () => {
    const draftOnly = computeManagementSummary({
      period: { unit: "month", year: 2026, month: 9 },
      financeMonths: months,
      annualTarget: null,
      receivables: [],
      today,
    });
    expect(draftOnly.changes.previous.revenue).toEqual({
      rate: null,
      reason: "no-current-data",
    });
    expect(draftOnly.changes.lastYear.profit).toEqual({
      rate: null,
      reason: "no-current-data",
    });
  });

  it("전년 데이터 없음 → no-data", () => {
    const noLastYear = computeManagementSummary({
      period: { unit: "quarter", year: 2026, quarter: 3 },
      financeMonths: months.filter((m) => m.year === 2026),
      annualTarget: null,
      receivables: [],
      today,
    });
    expect(noLastYear.changes.lastYear.revenue).toEqual({
      rate: null,
      reason: "no-data",
    });
    expect(noLastYear.changes.lastYear.profit).toEqual({
      rate: null,
      reason: "no-data",
    });
    expect(noLastYear.targets.annual).toBeNull();
  });

  it("목표: 분기 목표 = 연간 ÷ 4", () => {
    expect(summary.targets.period).toMatchObject({
      kind: "quarter",
      target: 1_000n,
      actual: 600n,
    });
    expect(summary.targets.annual).toMatchObject({
      target: 4_000n,
      actual: 1_200n,
    });
  });

  it("미수금 기준일 = min(기간 마지막 날, 오늘)", () => {
    expect(summary.receivables.asOf.toISOString()).toBe(
      "2026-09-30T00:00:00.000Z",
    );
    expect(summary.receivables.total).toBe(70n);

    const current = computeManagementSummary({
      period: { unit: "year", year: 2026 },
      financeMonths: months,
      annualTarget: null,
      receivables: [],
      today,
    });
    expect(current.receivables.asOf).toBe(today);
  });
});
