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

  it("미확정 월이 있으면 같은 월끼리 비교 (3분기 7·8월 ↔ 2분기 4·5월, 전년 7·8월)", () => {
    expect(summary.changes.previous).toMatchObject({
      label: "2026년 2분기",
      isPartial: false, // 비교 기간(4·5월)은 모두 확정
      aligned: {
        current: [
          { year: 2026, month: 7 },
          { year: 2026, month: 8 },
        ],
        base: [
          { year: 2026, month: 4 },
          { year: 2026, month: 5 },
        ],
      },
      revenue: { rate: 0.5 }, // 600 vs 400 (전체 600 이 아니라 4·5월만)
    });
    expect(summary.changes.lastYear).toMatchObject({
      label: "2025년 3분기",
      aligned: {
        base: [
          { year: 2025, month: 7 },
          { year: 2025, month: 8 },
        ],
      },
      revenue: { rate: 2 }, // 600 vs 200
    });
  });

  it("모든 월이 확정된 기간은 전체 비교 (aligned 없음)", () => {
    const q2 = computeManagementSummary({
      period: { unit: "quarter", year: 2026, quarter: 2 },
      financeMonths: months,
      annualTarget: null,
      receivables: [],
      today,
    });
    expect(q2.changes.lastYear.aligned).toBeNull();
  });

  it("연간: 2026 1~8월 확정 → 2025도 1~8월만", () => {
    const year = Array.from({ length: 12 }, (_, i) =>
      financeMonth(2025, i + 1, sales(100n)),
    ).concat(
      Array.from({ length: 9 }, (_, i) =>
        financeMonth(2026, i + 1, {
          ...sales(100n),
          status: i + 1 === 9 ? "DRAFT" : "CONFIRMED",
        }),
      ),
    );
    const s2026 = computeManagementSummary({
      period: { unit: "year", year: 2026 },
      financeMonths: year,
      annualTarget: null,
      receivables: [],
      today,
    });
    expect(s2026.changes.lastYear.aligned?.base.map((m) => m.month)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(s2026.changes.lastYear.revenue).toEqual({ rate: 0 }); // 800 vs 800 (전체 1,200 아님)
  });

  it("마감 전 달만 남은 진행 중 분기도 같은 월끼리", () => {
    const q4 = computeManagementSummary({
      period: { unit: "quarter", year: 2026, quarter: 4 },
      financeMonths: [
        financeMonth(2026, 7, sales(100n)),
        financeMonth(2026, 8, sales(100n)),
        financeMonth(2026, 9, sales(100n)),
        financeMonth(2026, 10, sales(150n)),
      ],
      annualTarget: null,
      receivables: [],
      today: date("2026-11-20"), // 10월 마감, 11·12월 마감 전
    });
    expect(q4.changes.previous.aligned?.base).toEqual([
      { year: 2026, month: 7 },
    ]);
    expect(q4.changes.previous.revenue).toEqual({ rate: 0.5 }); // 10월 150 vs 7월 100
  });

  it("비교 기간 쪽 같은 월이 미확정이면 isPartial 유지", () => {
    const draftBase = months.map((m) =>
      m.year === 2026 && m.month === 5 ? { ...m, status: "DRAFT" as const } : m,
    );
    const s = computeManagementSummary({
      period: { unit: "quarter", year: 2026, quarter: 3 },
      financeMonths: draftBase,
      annualTarget: null,
      receivables: [],
      today,
    });
    expect(s.changes.previous.isPartial).toBe(true);
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

describe("상세 표용 값", () => {
  const months = [
    financeMonth(2026, 4, { productSales: 200n, goodsSales: 100n }),
    financeMonth(2026, 7, { productSales: 300n, goodsSales: 0n }),
  ];
  const s = computeManagementSummary({
    period: { unit: "quarter", year: 2026, quarter: 3 },
    financeMonths: months,
    annualTarget: {
      year: 2026,
      revenueTarget: 4_000n,
      quarterTargets: [null, null, null, null],
    },
    receivables: [],
    today: date("2026-10-16"),
  });

  it("항목별 직전 기간 증감률", () => {
    expect(s.changes.previous.revenueItems.product).toEqual({ rate: 0.5 }); // 300 vs 200
    expect(s.changes.previous.revenueItems.goods).toEqual({ rate: -1 }); // 0 vs 100
    expect(s.changes.previous.revenueItems.service).toEqual({
      rate: null,
      reason: "zero-base",
    });
  });

  it("분기별 확정 실적", () => {
    expect(s.targets.quarterActuals).toEqual([0n, 300n, 300n, 0n]);
  });
});
