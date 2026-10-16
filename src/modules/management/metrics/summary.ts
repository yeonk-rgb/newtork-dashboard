// 기간 하나에 대한 경영지원 지표 종합 (순수 함수)
import {
  periodEndDate,
  periodLabel,
  previousPeriod,
  samePeriodLastYear,
  type Period,
} from "@/shared/period/period";

import { selectConfirmed } from "./confirmation";
import { computeExpenses } from "./expenses";
import { changeRate } from "./math";
import { computeProfit } from "./profit";
import { computeReceivables } from "./receivables";
import { computeRevenue } from "./revenue";
import { DEFAULT_METRICS_SETTINGS, type MetricsSettings } from "./settings";
import { computeTargets } from "./targets";
import type {
  AnnualTargetInput,
  Change,
  Comparison,
  FinanceMonth,
  ManagementSummary,
  MarginChange,
  PeriodCore,
  ReceivableInput,
} from "./types";

export type SummaryInput = {
  period: Period;
  /** 기간·직전 기간·전년 동기·해당 연도 1월부터를 포함하는 월 데이터 (DRAFT 포함) */
  financeMonths: FinanceMonth[];
  /** 해당 연도 목표 (없으면 null) */
  annualTarget: AnnualTargetInput | null;
  receivables: ReceivableInput[];
  /** 오늘 (UTC 자정) — 마감 여부, 미수금 기준일 계산 */
  today: Date;
  settings?: MetricsSettings;
};

export function computePeriodCore(
  period: Period,
  financeMonths: FinanceMonth[],
  today: Date,
  settings: MetricsSettings,
): PeriodCore {
  const { confirmed, confirmation } = selectConfirmed(
    period,
    financeMonths,
    today,
  );
  const revenue = computeRevenue(confirmed);
  const expenses = computeExpenses(confirmed);
  return {
    period,
    label: periodLabel(period),
    confirmation,
    revenue,
    expenses,
    profit: computeProfit(revenue, expenses, settings.costMode),
  };
}

function compare(current: PeriodCore, base: PeriodCore): Comparison {
  const rate = (now: bigint, before: bigint): Change => {
    if (!current.confirmation.hasData) {
      return { rate: null, reason: "no-current-data" };
    }
    return changeRate(now, base.confirmation.hasData ? before : null);
  };
  return {
    period: base.period,
    label: base.label,
    isPartial: current.confirmation.isPartial || base.confirmation.isPartial,
    revenue: rate(current.revenue.total, base.revenue.total),
    expense: rate(current.expenses.total, base.expenses.total),
    profit: rate(current.profit.profit, base.profit.profit),
    margin: marginChange(current, base),
  };
}

function marginChange(current: PeriodCore, base: PeriodCore): MarginChange {
  if (!current.confirmation.hasData)
    return { diff: null, reason: "no-current-data" };
  if (!base.confirmation.hasData) return { diff: null, reason: "no-data" };
  const now = current.profit.margin;
  const before = base.profit.margin;
  if (now === null || before === null)
    return { diff: null, reason: "no-margin" };
  return { diff: now - before };
}

export function computeManagementSummary(
  input: SummaryInput,
): ManagementSummary {
  const settings = input.settings ?? DEFAULT_METRICS_SETTINGS;
  const { period, financeMonths, today } = input;

  const core = computePeriodCore(period, financeMonths, today, settings);
  const previous = computePeriodCore(
    previousPeriod(period),
    financeMonths,
    today,
    settings,
  );
  const lastYear = computePeriodCore(
    samePeriodLastYear(period),
    financeMonths,
    today,
    settings,
  );

  // 미수금 기준일 = min(기간 마지막 날, 오늘)
  const end = periodEndDate(period);
  const asOf = end.getTime() < today.getTime() ? end : today;

  return {
    ...core,
    targets: computeTargets(period, input.annualTarget, financeMonths),
    changes: {
      previous: compare(core, previous),
      lastYear: compare(core, lastYear),
    },
    receivables: computeReceivables(
      input.receivables,
      asOf,
      settings.expectedCollectionMonths,
    ),
  };
}
