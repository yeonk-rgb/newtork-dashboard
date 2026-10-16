// 기간 하나의 지표 계산에 필요한 데이터를 한 번에 조회 (서버 전용)
import "server-only";

import {
  monthIndex,
  periodMonths,
  previousPeriod,
  samePeriodLastYear,
  type Period,
} from "@/shared/period/period";

import type { SummaryInput } from "../metrics/summary";
import {
  loadAnnualTarget,
  loadFinanceMonths,
  loadReceivables,
} from "./queries";

/** 기간 + 직전 기간 + 전년 동기 + 해당 연도 1월부터 (목표 누적용) */
export function requiredMonthRange(period: Period) {
  const all = [period, previousPeriod(period), samePeriodLastYear(period)]
    .flatMap(periodMonths)
    .concat({ year: period.year, month: 1 })
    .map(monthIndex);
  return { from: Math.min(...all), to: Math.max(...all) };
}

/** 오늘 날짜 (한국 시간 기준, UTC 자정 Date) */
export function todayKst(now = new Date()): Date {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()),
  );
}

export async function loadSummaryInput(
  period: Period,
  today: Date = todayKst(),
): Promise<SummaryInput> {
  const { from, to } = requiredMonthRange(period);
  const [financeMonths, annualTarget, receivables] = await Promise.all([
    loadFinanceMonths(from, to),
    loadAnnualTarget(period.year),
    loadReceivables(),
  ]);
  return { period, financeMonths, annualTarget, receivables, today };
}
