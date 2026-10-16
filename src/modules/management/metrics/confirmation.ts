// 확정(CONFIRMED)된 달만 집계하고, 미확정 월 목록을 함께 돌려준다.
import {
  monthIndex,
  periodMonths,
  type Period,
  type YearMonth,
} from "@/shared/period/period";

import type { Confirmation, FinanceMonth, UnconfirmedMonth } from "./types";

/**
 * @param today 오늘 날짜 — 오늘이 속한 달과 그 이후는 아직 마감 전(pending)으로 본다
 * @param onlyMonths 지정하면 기간 전체 대신 이 월들만 본다 (같은 월끼리 비교용)
 */
export function selectConfirmed(
  period: Period,
  months: FinanceMonth[],
  today: Date,
  onlyMonths?: YearMonth[],
): { confirmed: FinanceMonth[]; confirmation: Confirmation } {
  const currentIndex = monthIndex({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
  });
  const byIndex = new Map(months.map((m) => [monthIndex(m), m]));

  const confirmed: FinanceMonth[] = [];
  const unconfirmedMonths: UnconfirmedMonth[] = [];
  const pendingMonths: YearMonth[] = [];

  for (const ym of onlyMonths ?? periodMonths(period)) {
    const row = byIndex.get(monthIndex(ym));
    if (row?.status === "CONFIRMED") {
      confirmed.push(row);
    } else if (monthIndex(ym) >= currentIndex) {
      pendingMonths.push(ym);
    } else {
      unconfirmedMonths.push({ ...ym, reason: row ? "DRAFT" : "MISSING" });
    }
  }

  return {
    confirmed,
    confirmation: {
      confirmedMonths: confirmed.map(({ year, month }) => ({ year, month })),
      unconfirmedMonths,
      pendingMonths,
      isPartial: unconfirmedMonths.length > 0,
      hasData: confirmed.length > 0,
    },
  };
}
