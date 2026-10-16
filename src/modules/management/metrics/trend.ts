// 월별 추이 (차트용): 기간 끝에서 거꾸로 N개월.
// - 미확정(DRAFT) 월도 값을 보여주되 status 로 구분 (화면에서 옅게/빗금 + "미확정")
// - 데이터 없는 달(MISSING)·마감 전 달(PENDING)은 값이 null → 빈칸 (0으로 그리지 않음)
import {
  addMonths,
  monthIndex,
  periodMonths,
  type Period,
  type YearMonth,
} from "@/shared/period/period";

import { computeExpenses } from "./expenses";
import { computeProfit } from "./profit";
import { computeRevenue } from "./revenue";
import type { CostMode, FinanceMonth } from "./types";

export type TrendStatus = "CONFIRMED" | "DRAFT" | "MISSING" | "PENDING";

export type TrendPoint = YearMonth & {
  status: TrendStatus;
  /** 값이 있는 달(CONFIRMED·DRAFT)만, 그 외 null */
  revenue: bigint | null;
  expense: bigint | null;
  profit: bigint | null;
  margin: number | null;
  /** 매출 구성 (제품·상품·용역) */
  product: bigint | null;
  goods: bigint | null;
  service: bigint | null;
};

export const TREND_MONTHS = 12;

/** 추이 범위: 기간 마지막 달에서 거꾸로 count 개월 (오름차순) */
export function trendRange(period: Period, count = TREND_MONTHS): YearMonth[] {
  const last = periodMonths(period).at(-1)!;
  return Array.from({ length: count }, (_, i) =>
    addMonths(last, i - (count - 1)),
  );
}

export function computeTrend(
  period: Period,
  financeMonths: FinanceMonth[],
  today: Date,
  costMode: CostMode,
  count = TREND_MONTHS,
): TrendPoint[] {
  const currentIndex = monthIndex({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
  });
  const byIndex = new Map(financeMonths.map((m) => [monthIndex(m), m]));

  return trendRange(period, count).map((ym) => {
    const row = byIndex.get(monthIndex(ym));
    if (!row) {
      return {
        ...ym,
        status: monthIndex(ym) >= currentIndex ? "PENDING" : "MISSING",
        revenue: null,
        expense: null,
        profit: null,
        margin: null,
        product: null,
        goods: null,
        service: null,
      };
    }
    const revenue = computeRevenue([row]);
    const expenses = computeExpenses([row]);
    const profit = computeProfit(revenue, expenses, costMode);
    return {
      ...ym,
      status: row.status,
      revenue: revenue.total,
      expense: expenses.total,
      profit: profit.profit,
      margin: profit.margin,
      product: row.productSales,
      goods: row.goodsSales,
      service: row.serviceSales,
    };
  });
}
