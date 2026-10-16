import { ratio, sum } from "./math";
import type { FinanceMonth, RevenueResult } from "./types";

/** 총매출 = 제품 + 상품 + 용역 */
export function monthRevenue(m: FinanceMonth): bigint {
  return m.productSales + m.goodsSales + m.serviceSales;
}

export function computeRevenue(months: FinanceMonth[]): RevenueResult {
  const parts = [
    {
      key: "product",
      label: "제품 매출",
      amount: sum(months.map((m) => m.productSales)),
    },
    {
      key: "goods",
      label: "상품 매출",
      amount: sum(months.map((m) => m.goodsSales)),
    },
    {
      key: "service",
      label: "용역 매출",
      amount: sum(months.map((m) => m.serviceSales)),
    },
  ];
  const total = sum(parts.map((p) => p.amount));
  return {
    total,
    items: parts.map((p) => ({ ...p, ratio: ratio(p.amount, total) })),
  };
}
