import { ratio } from "./math";
import type {
  CostMode,
  ExpenseResult,
  ProfitResult,
  RevenueResult,
} from "./types";

/** 단순 이익 = 총매출 − 비용, 이익률 = 이익 ÷ 총매출 */
export function computeProfit(
  revenue: RevenueResult,
  expenses: ExpenseResult,
  costMode: CostMode,
): ProfitResult {
  const amount = (key: string) =>
    expenses.items.find((item) => item.key === key)?.amount ?? 0n;

  const cost =
    costMode === "purchases"
      ? expenses.total
      : amount("operatingExpense") + amount("otherExpense");

  const profit = revenue.total - cost;
  return { costMode, cost, profit, margin: ratio(profit, revenue.total) };
}
