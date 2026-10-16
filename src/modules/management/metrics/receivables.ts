// 미수금: 기준일(asOf) 시점의 잔액
// - 기준일에 미수 = 발생일 ≤ 기준일 그리고 (아직 미수 또는 수금일 > 기준일)
// - 경과일은 발생일부터 (docs/05-open-questions.md 17번 확인 전)
import { addMonths, monthIndex } from "@/shared/period/period";

import { sum } from "./math";
import type { AgingBucket, ReceivableInput, ReceivableResult } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

export function isOutstandingAt(r: ReceivableInput, asOf: Date): boolean {
  if (r.occurredOn.getTime() > asOf.getTime()) return false;
  if (!r.isCollected) return true;
  // 수금 완료인데 수금일이 기준일 이후면 그 시점엔 미수
  return r.collectedOn !== null && r.collectedOn.getTime() > asOf.getTime();
}

export function agingBucket(days: number): AgingBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

const total = (list: ReceivableInput[]) => ({
  amount: sum(list.map((r) => r.amount)),
  count: list.length,
});

export function computeReceivables(
  receivables: ReceivableInput[],
  asOf: Date,
  horizonMonths: number,
): ReceivableResult {
  const open = receivables.filter((r) => isOutstandingAt(r, asOf));

  // 거래처별 (금액 큰 순, 같으면 이름순)
  const customers = new Map<string, ReceivableInput[]>();
  for (const r of open) {
    customers.set(r.customerName, [
      ...(customers.get(r.customerName) ?? []),
      r,
    ]);
  }
  const byCustomer = [...customers.entries()]
    .map(([customerName, list]) => ({ customerName, ...total(list) }))
    .sort((a, b) =>
      a.amount === b.amount
        ? a.customerName.localeCompare(b.customerName, "ko")
        : a.amount > b.amount
          ? -1
          : 1,
    );

  // 경과일 구간
  const buckets: AgingBucket[] = ["0-30", "31-60", "61-90", "90+"];
  const aging = buckets.map((bucket) => ({
    bucket,
    ...total(
      open.filter(
        (r) => agingBucket(daysBetween(r.occurredOn, asOf)) === bucket,
      ),
    ),
  }));

  // 수금 예정
  const asOfYm = { year: asOf.getUTCFullYear(), month: asOf.getUTCMonth() + 1 };
  const withDue = open.filter((r) => r.dueOn !== null);
  const overdue = withDue.filter((r) => r.dueOn!.getTime() < asOf.getTime());
  const upcoming = withDue.filter((r) => r.dueOn!.getTime() >= asOf.getTime());
  const dueIndex = (r: ReceivableInput) =>
    monthIndex({
      year: r.dueOn!.getUTCFullYear(),
      month: r.dueOn!.getUTCMonth() + 1,
    });

  const months = Array.from({ length: horizonMonths }, (_, i) => {
    const ym = addMonths(asOfYm, i);
    return {
      ...ym,
      ...total(upcoming.filter((r) => dueIndex(r) === monthIndex(ym))),
    };
  });
  const lastIndex = monthIndex(addMonths(asOfYm, horizonMonths - 1));

  const items = open
    .map((r) => {
      const ageDays = daysBetween(r.occurredOn, asOf);
      return {
        id: r.id,
        customerName: r.customerName,
        occurredOn: r.occurredOn,
        amount: r.amount,
        dueOn: r.dueOn,
        note: r.note ?? null,
        ageDays,
        bucket: agingBucket(ageDays),
        isOverdue: r.dueOn !== null && r.dueOn.getTime() < asOf.getTime(),
      };
    })
    .sort((a, b) => (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1));

  const openTotal = total(open);
  return {
    asOf,
    total: openTotal.amount,
    count: openTotal.count,
    items,
    byCustomer,
    aging,
    expected: {
      overdue: total(overdue),
      months,
      later: total(upcoming.filter((r) => dueIndex(r) > lastIndex)),
      noDueDate: total(open.filter((r) => r.dueOn === null)),
    },
  };
}
