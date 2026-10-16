import { ratio, sum } from "./math";
import type { ExpenseResult, FinanceMonth } from "./types";

/** 그 외 지출 합계 */
export function monthOtherExpense(m: FinanceMonth): bigint {
  return sum(m.otherExpenses.map((e) => e.amount));
}

/** 총지출 = 상품매입 + 원재료매입 + 경비 + 그 외 지출 */
export function computeExpenses(months: FinanceMonth[]): ExpenseResult {
  const other = new Map<
    string,
    { name: string; sortOrder: number; amount: bigint }
  >();
  for (const m of months) {
    for (const e of m.otherExpenses) {
      const prev = other.get(e.categoryId);
      other.set(e.categoryId, {
        name: e.name,
        sortOrder: e.sortOrder,
        amount: (prev?.amount ?? 0n) + e.amount,
      });
    }
  }
  const otherTotal = sum([...other.values()].map((o) => o.amount));

  const parts = [
    {
      key: "goodsPurchase",
      label: "상품 매입",
      amount: sum(months.map((m) => m.goodsPurchase)),
    },
    {
      key: "materialPurchase",
      label: "원재료 매입",
      amount: sum(months.map((m) => m.materialPurchase)),
    },
    {
      key: "operatingExpense",
      label: "경비",
      amount: sum(months.map((m) => m.operatingExpense)),
    },
    { key: "otherExpense", label: "그 외 지출", amount: otherTotal },
  ];
  const total = sum(parts.map((p) => p.amount));

  return {
    total,
    items: parts.map((p) => ({ ...p, ratio: ratio(p.amount, total) })),
    otherItems: [...other.entries()]
      .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
      .map(([categoryId, o]) => ({
        key: categoryId,
        label: o.name,
        amount: o.amount,
        ratio: ratio(o.amount, total),
      })),
  };
}
