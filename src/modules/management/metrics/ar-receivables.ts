// 대시보드·리포트 미수금 (순수 함수, 2026-10-26 결정 05-22) — 채권·채무 관리 외상매출금 기준
// - 기준월 = 기간 안에서 오늘이 속한 달까지, 외상매출금 행이 있는 마지막 달 (없으면 "입력 없음" — 다른 달 값을 끌어오지 않음)
// - 미수 = 장기미수 + 당월수금예정 (원본 「경영지원 관리」 그룹). 당월수금완료는 그 달에 받은 돈이라 따로
// - 경과일 구간(90일 초과 등) 대신 담당자가 정한 "장기미수" 구분을 쓴다 (외상매출금에는 발생일이 없음)
import {
  addMonths,
  monthIndex,
  periodEndDate,
  periodMonths,
  type Period,
  type YearMonth,
} from "@/shared/period/period";

import { sum } from "./math";
import type {
  AmountCount,
  ArEntryInput,
  ReceivableItem,
  ReceivableResult,
} from "./types";

const ymOf = (d: Date): YearMonth => ({
  year: d.getUTCFullYear(),
  month: d.getUTCMonth() + 1,
});
const lastDayOf = (ym: YearMonth) => new Date(Date.UTC(ym.year, ym.month, 0));

const total = (list: { amount: bigint }[]): AmountCount => ({
  amount: sum(list.map((r) => r.amount)),
  count: list.length,
});

const byAmountDesc = (a: { amount: bigint }, b: { amount: bigint }) =>
  a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1;

/** 기간 안에서 외상매출금 행이 있는 마지막 달 (오늘이 속한 달까지) */
export function arBaseMonth(
  entries: ArEntryInput[],
  period: Period,
  today: Date,
): YearMonth | null {
  const limit = monthIndex(ymOf(today));
  const has = new Set(entries.map((e) => monthIndex(e)));
  const months = periodMonths(period)
    .filter((m) => monthIndex(m) <= limit)
    .reverse();
  return months.find((m) => has.has(monthIndex(m))) ?? null;
}

export function computeArReceivables(
  entries: ArEntryInput[],
  period: Period,
  today: Date,
  horizonMonths: number,
): ReceivableResult {
  const month = arBaseMonth(entries, period, today);
  const end = month ? lastDayOf(month) : periodEndDate(period);
  const asOf = end.getTime() < today.getTime() ? end : today;
  const rows = month
    ? entries.filter((e) => monthIndex(e) === monthIndex(month))
    : [];

  const longOverdue = rows.filter((e) => e.status === "LONG_OVERDUE");
  const scheduled = rows.filter((e) => e.status === "SCHEDULED");
  const collected = rows.filter((e) => e.status === "COLLECTED");
  const open = [...longOverdue, ...scheduled];

  const items: ReceivableItem[] = open
    .map((e) => ({
      id: e.id,
      customerName: e.partnerName,
      amount: e.amount,
      status: e.status as ReceivableItem["status"],
      dueOn: e.dueOn,
      note: e.note,
      isOverdue:
        e.status === "SCHEDULED" &&
        e.dueOn !== null &&
        e.dueOn.getTime() < asOf.getTime(),
    }))
    .sort(byAmountDesc);

  // 거래처별 (금액 큰 순, 같으면 이름순)
  const customers = new Map<string, ReceivableItem[]>();
  for (const i of items) {
    customers.set(i.customerName, [
      ...(customers.get(i.customerName) ?? []),
      i,
    ]);
  }
  const byCustomer = [...customers.entries()]
    .map(([customerName, list]) => ({
      customerName,
      ...total(list),
      longOverdue: sum(
        list.filter((i) => i.status === "LONG_OVERDUE").map((i) => i.amount),
      ),
    }))
    .sort((a, b) =>
      a.amount === b.amount
        ? a.customerName.localeCompare(b.customerName, "ko")
        : byAmountDesc(a, b),
    );

  // 수금 예정 (당월수금예정 행의 예정일)
  const startYm = month ?? ymOf(asOf);
  const withDue = scheduled.filter((e) => e.dueOn !== null);
  const dueIndex = (e: ArEntryInput) => monthIndex(ymOf(e.dueOn!));
  const overdue = withDue.filter((e) => e.dueOn!.getTime() < asOf.getTime());
  const upcoming = withDue.filter((e) => e.dueOn!.getTime() >= asOf.getTime());
  const months = Array.from({ length: horizonMonths }, (_, i) => {
    const ym = addMonths(startYm, i);
    return {
      ...ym,
      ...total(upcoming.filter((e) => dueIndex(e) === monthIndex(ym))),
    };
  });
  const lastIndex = monthIndex(addMonths(startYm, horizonMonths - 1));

  const openTotal = total(open);
  return {
    asOf,
    month,
    isCurrentMonth:
      month !== null && monthIndex(month) === monthIndex(ymOf(today)),
    total: openTotal.amount,
    count: openTotal.count,
    customerCount: byCustomer.length,
    longOverdue: total(longOverdue),
    scheduled: total(scheduled),
    collected: total(collected),
    items,
    byCustomer,
    expected: {
      overdue: total(overdue),
      months,
      later: total(upcoming.filter((e) => dueIndex(e) > lastIndex)),
      noDueDate: total(scheduled.filter((e) => e.dueOn === null)),
    },
  };
}
