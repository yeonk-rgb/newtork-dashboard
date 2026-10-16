// 테스트용 데이터 생성 도우미 (테스트에서만 import)
import type { FinanceMonth, ReceivableInput } from "./types";

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
