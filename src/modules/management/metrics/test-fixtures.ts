// 테스트용 데이터 생성 도우미 (테스트에서만 import)
import type { ArEntryInput, FinanceMonth, ReceivableInput } from "./types";

export function financeMonth(
  year: number,
  month: number,
  overrides: Partial<FinanceMonth> = {},
): FinanceMonth {
  return {
    year,
    month,
    status: "CONFIRMED",
    productSales: 0n,
    goodsSales: 0n,
    serviceSales: 0n,
    goodsPurchase: 0n,
    materialPurchase: 0n,
    operatingExpense: 0n,
    otherExpenses: [],
    ...overrides,
  };
}

export function date(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function receivable(
  id: string,
  overrides: Partial<ReceivableInput> = {},
): ReceivableInput {
  return {
    id,
    customerName: "가나(가상)",
    occurredOn: date("2026-09-01"),
    amount: 1_000_000n,
    isCollected: false,
    collectedOn: null,
    dueOn: null,
    ...overrides,
  };
}

/** 채권·채무 외상매출금 한 행 (기본: 2026년 9월 당월수금예정) — 대시보드 미수금 입력 */
export function arEntry(
  id: string,
  overrides: Partial<ArEntryInput> = {},
): ArEntryInput {
  return {
    id,
    year: 2026,
    month: 9,
    status: "SCHEDULED",
    partnerName: "가나(가상)",
    amount: 1_000_000n,
    dueOn: null,
    settledOn: null,
    note: null,
    ...overrides,
  };
}
