import { describe, expect, it } from "vitest";

import {
  computeCashForecast,
  withVat,
  type CashForecastInput,
  type CashLedgerRow,
} from "./cash-forecast";
import type { FinanceMonth } from "./types";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const TODAY = d("2026-10-26");

const finance = (
  month: number,
  status: "CONFIRMED" | "DRAFT" = "CONFIRMED",
  patch: Partial<FinanceMonth> = {},
): FinanceMonth => ({
  year: 2026,
  month,
  status,
  productSales: 100_000_000n,
  goodsSales: 0n,
  serviceSales: 0n,
  goodsPurchase: 20_000_000n,
  materialPurchase: 20_000_000n,
  operatingExpense: 10_000_000n,
  otherExpenses: [
    {
      categoryId: "c",
      name: "광고선전비",
      sortOrder: 0,
      costType: null,
      amount: 10_000_000n,
    },
  ],
  ...patch,
});

const ar = (
  arStatus: CashLedgerRow["arStatus"],
  amount: bigint,
  dueOn: string | null,
): CashLedgerRow => ({
  kind: "AR",
  arStatus,
  amount,
  dueOn: dueOn ? d(dueOn) : null,
  settledOn: null,
});
const pay = (
  kind: CashLedgerRow["kind"],
  amount: bigint,
  dueOn: string | null = null,
  settledOn: string | null = null,
): CashLedgerRow => ({
  kind,
  arStatus: null,
  amount,
  dueOn: dueOn ? d(dueOn) : null,
  settledOn: settledOn ? d(settledOn) : null,
});

const input = (patch: Partial<CashForecastInput> = {}): CashForecastInput => ({
  today: TODAY,
  ledger: {
    month: { year: 2026, month: 10 },
    rows: [
      ar("SCHEDULED", 30_000_000n, "2026-11-30"),
      ar("SCHEDULED", 20_000_000n, "2026-12-15"),
      ar("SCHEDULED", 5_000_000n, "2026-09-30"), // 예정일 지남 → 첫 달
      ar("SCHEDULED", 1_000_000n, null), // 예정일 없음 → 첫 달
      ar("SCHEDULED", 9_000_000n, "2027-06-30"), // 기간 밖
      ar("LONG_OVERDUE", 40_000_000n, null), // 넣지 않음
      ar("COLLECTED", 7_000_000n, null), // 이미 들어온 돈
      pay("AP", 22_000_000n), // 예정일 없음 → 11월
      pay("ACCRUED_STAFF", 8_000_000n),
      pay("ACCRUED_VENDOR", 1_100_000n, "2027-01-10"),
      pay("ACCRUED_VENDOR", 500_000n, null, "2026-10-20"), // 이미 나감
    ],
  },
  financeMonths: [
    finance(6),
    finance(7),
    finance(8, "CONFIRMED", { productSales: 130_000_000n }),
    finance(9, "DRAFT", { productSales: 999_000_000n }), // 확정 아님 → 평균 제외
  ],
  cashBalance: { year: 2026, month: 10, amount: 200_000_000n },
  settings: { averageMonths: 3, maxMonths: 6 },
  ...patch,
});

describe("×1.1 환산", () => {
  it("원 단위 반올림", () => {
    expect(withVat(10_000_000n)).toBe(11_000_000n);
    expect(withVat(15n)).toBe(17n); // 16.5 → 17
  });
});

describe("자금 수지 예측", () => {
  const f = computeCashForecast(input());

  it("다음 달부터 6개월, 경영지원 관리 기준월", () => {
    expect(f.months.map((m) => `${m.year}-${m.month}`)).toEqual([
      "2026-11",
      "2026-12",
      "2027-1",
      "2027-2",
      "2027-3",
      "2027-4",
    ]);
    expect(f.ledgerMonth).toEqual({ year: 2026, month: 10 });
  });

  it("들어올 돈 예정: 수금예정 예정일 달, 예정일 없음·지남은 첫 달, 장기 미수금·당월 수금 제외", () => {
    expect(f.months.map((m) => m.inflowPlanned)).toEqual([
      36_000_000n,
      20_000_000n,
      0n,
      0n,
      0n,
      0n,
    ]);
    expect(f.notes.carriedInflow).toEqual({ amount: 6_000_000n, count: 2 });
    expect(f.notes.longOverdue).toEqual({ amount: 40_000_000n, count: 1 });
    expect(f.notes.beyondInflow).toEqual({ amount: 9_000_000n, count: 1 });
  });

  it("나갈 돈 예정: 예정일 없으면 기준월 다음 달, 예정일 있으면 그 달, 완료일 있으면 제외", () => {
    expect(f.months.map((m) => m.outflowPlanned)).toEqual([
      30_000_000n,
      0n,
      1_100_000n,
      0n,
      0n,
      0n,
    ]);
  });

  it("추정: 기준월+2 달부터 최근 확정 3개월 평균 (매출·매입·그 외 ×1.1, 경비 그대로)", () => {
    // 매출 평균 (100+100+130)/3 = 110,000,000 → ×1.1 = 121,000,000 (월별 ×1.1 후 평균)
    expect(f.average).toEqual({
      months: [
        { year: 2026, month: 6 },
        { year: 2026, month: 7 },
        { year: 2026, month: 8 },
      ],
      inflow: 121_000_000n,
      // (20+20+10)×1.1 + 10 = 65,000,000
      outflow: 65_000_000n,
    });
    expect(f.months[0].inflowEstimated).toBeNull();
    expect(f.months[0].outflowEstimated).toBeNull();
    expect(f.months[1].inflowEstimated).toBe(121_000_000n);
    expect(f.months[1].outflowEstimated).toBe(65_000_000n);
  });

  it("순수지·누적·예상 잔액 (통장 잔액 + 누적)", () => {
    expect(f.months[0]).toMatchObject({
      net: 6_000_000n,
      cumulative: 6_000_000n,
      balance: 206_000_000n,
    });
    // 12월: 20,000,000 + 121,000,000 − 65,000,000 = 76,000,000
    expect(f.months[1]).toMatchObject({
      net: 76_000_000n,
      cumulative: 82_000_000n,
      balance: 282_000_000n,
    });
    expect(f.opening).toEqual({
      year: 2026,
      month: 10,
      amount: 200_000_000n,
      gapMonths: 0,
    });
  });

  it("통장 잔액이 없으면 예상 잔액 null, 오래된 잔액이면 빠진 개월 수", () => {
    expect(
      computeCashForecast(input({ cashBalance: null })).months[0].balance,
    ).toBeNull();
    expect(
      computeCashForecast(
        input({ cashBalance: { year: 2026, month: 8, amount: 1n } }),
      ).opening?.gapMonths,
    ).toBe(2);
  });

  it("경영지원 관리 기준월이 지난달이면 기본 지급 달(이번 달)은 이미 지난 것으로 보고, 첫 달부터 추정", () => {
    const g = computeCashForecast(
      input({
        ledger: {
          month: { year: 2026, month: 9 },
          rows: [pay("AP", 22_000_000n), ar("SCHEDULED", 3_000_000n, null)],
        },
      }),
    );
    expect(g.notes.pastOutflow).toEqual({ amount: 22_000_000n, count: 1 });
    expect(g.months[0].outflowPlanned).toBe(0n);
    expect(g.months[0].inflowPlanned).toBe(3_000_000n);
    expect(g.months[0].inflowEstimated).toBe(121_000_000n);
  });

  it("경영지원 관리·확정 월이 없으면 예정 0, 추정 null", () => {
    const g = computeCashForecast(
      input({ ledger: null, financeMonths: [], cashBalance: null }),
    );
    expect(g.average).toBeNull();
    expect(
      g.months.every(
        (m) =>
          m.inflowPlanned === 0n &&
          m.inflowEstimated === null &&
          m.net === 0n,
      ),
    ).toBe(true);
  });
});
