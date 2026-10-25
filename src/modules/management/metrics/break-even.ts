// 손익분기점(BEP) 달성률 (순수 함수) — 확정된 달의 금액을 합친 뒤 한 번 계산한다 (월별 달성률 평균 아님)
//   공헌이익 = 매출 − 변동비, 달성률 = 공헌이익 ÷ 고정비 (= 매출 ÷ BEP 매출)
//   BEP 매출 = 고정비 × 매출 ÷ 공헌이익 (BigInt, 원 단위 올림)
// 비용은 이익 계산과 같은 범위(costMode) — 변동비 + 고정비 = 이익 계산 비용이라 달성률 ≥ 100% ⇔ 흑자
import { ratio, sum } from "./math";
import type { BreakEvenSettings } from "./settings";
import type {
  BreakEvenItem,
  BreakEvenResult,
  CostMode,
  FinanceMonth,
} from "./types";

/** 확정된 달 → 계산 내역 (매입·경비는 설정, 그 외 지출은 항목 설정 — 미분류는 설정값) */
export function breakEvenItems(
  months: FinanceMonth[],
  costMode: CostMode,
  settings: BreakEvenSettings,
): BreakEvenItem[] {
  const total = (pick: (m: FinanceMonth) => bigint) => sum(months.map(pick));
  const items: BreakEvenItem[] = [];
  if (costMode === "purchases") {
    items.push(
      {
        key: "goodsPurchase",
        label: "상품 매입",
        amount: total((m) => m.goodsPurchase),
        costClass: settings.purchases,
        basis: "provisional",
      },
      {
        key: "materialPurchase",
        label: "원재료 매입",
        amount: total((m) => m.materialPurchase),
        costClass: settings.purchases,
        basis: "provisional",
      },
    );
  }
  items.push({
    key: "operatingExpense",
    label: "경비 지출",
    amount: total((m) => m.operatingExpense),
    costClass: settings.operatingExpense,
    basis: "provisional",
  });

  const other = new Map<string, { item: BreakEvenItem; sortOrder: number }>();
  for (const m of months) {
    for (const e of m.otherExpenses) {
      const prev = other.get(e.categoryId);
      other.set(e.categoryId, {
        sortOrder: e.sortOrder,
        item: {
          key: e.categoryId,
          label: e.name,
          amount: (prev?.item.amount ?? 0n) + e.amount,
          costClass: e.costType ?? settings.unclassifiedOther,
          basis: e.costType ? "category" : "unclassified",
        },
      });
    }
  }
  return [
    ...items,
    ...[...other.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((o) => o.item),
  ];
}

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

export function computeBreakEven(
  months: FinanceMonth[],
  revenue: bigint,
  costMode: CostMode,
  settings: BreakEvenSettings,
): BreakEvenResult {
  const items = breakEvenItems(months, costMode, settings);
  const of = (c: "FIXED" | "VARIABLE") =>
    sum(items.filter((i) => i.costClass === c).map((i) => i.amount));
  const variableCost = of("VARIABLE");
  const fixedCost = of("FIXED");
  const contribution = revenue - variableCost;
  const base = {
    items,
    revenue,
    variableCost,
    fixedCost,
    contribution,
    contributionRatio: ratio(contribution, revenue),
    unclassifiedCount: items.filter(
      (i) => i.basis === "unclassified" && i.amount !== 0n,
    ).length,
    provisionalNotes: settings.provisionalNotes,
  };
  const none = (reason: BreakEvenResult["reason"]): BreakEvenResult => ({
    ...base,
    bepRevenue: null,
    rate: null,
    gap: null,
    reason,
  });

  if (months.length === 0) return none("no-data");
  if (revenue === 0n) return none("no-revenue");
  if (fixedCost === 0n) return none("no-fixed-cost");
  if (contribution <= 0n) return none("not-reachable");

  const bepRevenue = ceilDiv(fixedCost * revenue, contribution);
  return {
    ...base,
    bepRevenue,
    rate: ratio(contribution, fixedCost),
    gap: revenue - bepRevenue,
    reason: null,
  };
}
