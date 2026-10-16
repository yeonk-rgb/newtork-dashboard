// 기간 하나의 지표 계산에 필요한 데이터를 한 번에 조회 (서버 전용)
import "server-only";

import { connection } from "next/server";

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

/** 기간 + 직전 기간 + 전년 동기 + 해당 연도 1~12월 (목표 누적·연간 도넛용) */
export function requiredMonthRange(period: Period) {
  const all = [period, previousPeriod(period), samePeriodLastYear(period)]
    .flatMap(periodMonths)
    .concat({ year: period.year, month: 1 }, { year: period.year, month: 12 })
    .map(monthIndex);
  return { from: Math.min(...all), to: Math.max(...all) };
}

/** now 를 한국 날짜로 (UTC 자정 Date). 순수 함수 — 현재 시각은 getTodayKst() 로 구한다 */
export function todayKst(now: Date): Date {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()),
  );
}

/**
 * 오늘 날짜 (한국 시간). cacheComponents 에서 현재 시각은 미리 그리기(prerender)에
 * 넣을 수 없으므로 connection() 으로 "요청 시점에 계산"을 표시한 뒤 구한다.
 */
export async function getTodayKst(): Promise<Date> {
  await connection();
  return todayKst(new Date());
}

export async function loadSummaryInput(
  period: Period,
  today: Date,
): Promise<SummaryInput> {
  const { from, to } = requiredMonthRange(period);
  const [financeMonths, annualTarget, receivables] = await Promise.all([
    loadFinanceMonths(from, to),
    loadAnnualTarget(period.year),
    loadReceivables(),
  ]);
  return { period, financeMonths, annualTarget, receivables, today };
}
