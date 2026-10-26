// 기간 하나에 대한 경영지원 지표 종합 (순수 함수)
import {
  monthIndex,
  periodLabel,
  periodMonths,
  previousPeriod,
  samePeriodLastYear,
  type Period,
  type YearMonth,
} from "@/shared/period/period";

import { computeArReceivables } from "./ar-receivables";
import { computeBreakEven } from "./break-even";
import { selectConfirmed } from "./confirmation";
import { computeExpenses } from "./expenses";
import { changeRate } from "./math";
import { computeProductivity } from "./productivity";
import { computeProfit } from "./profit";
import { computeRevenue } from "./revenue";
import { DEFAULT_METRICS_SETTINGS, type MetricsSettings } from "./settings";
import { computeAnnualProgress, computeTargets } from "./targets";
import type {
  AmountDiff,
  AmountShare,
  AnnualTargetInput,
  ArEntryInput,
  Change,
  Comparison,
  FinanceMonth,
  ManagementSummary,
  MarginChange,
  PeriodCore,
} from "./types";

export type SummaryInput = {
  period: Period;
  /** 기간·직전 기간·전년 동기·해당 연도 1월부터를 포함하는 월 데이터 (DRAFT 포함) */
  financeMonths: FinanceMonth[];
  /** 해당 연도 목표 (없으면 null) */
  annualTarget: AnnualTargetInput | null;
  /** 경영지원 관리 외상매출금 행 (기간이 속한 해, 숨긴 행 제외) — 대시보드 미수금 기준 (2026-10-26, 05-22) */
  receivables: ArEntryInput[];
  /** 오늘 (UTC 자정) — 마감 여부, 미수금 기준일 계산 */
  today: Date;
  settings?: MetricsSettings;
};

export function computePeriodCore(
  period: Period,
  financeMonths: FinanceMonth[],
  today: Date,
  settings: MetricsSettings,
  onlyMonths?: YearMonth[],
): PeriodCore {
  const { confirmed, confirmation } = selectConfirmed(
    period,
    financeMonths,
    today,
    onlyMonths,
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
    breakEven: computeBreakEven(
      confirmed,
      revenue.total,
      settings.costMode,
      settings.breakEven,
    ),
  };
}

/**
 * 비교 기간 계산. 현재 기간에 확정 안 된 달(미확정·마감 전)이 있으면
 * 현재의 확정 월과 "같은 순서"의 달만 비교 기간에서 집계한다.
 *   2026 3분기(7·8월 확정) vs 2분기 → 4·5월 / 2026 연간(1~8월) vs 2025 → 1~8월
 */
function baseCore(
  current: PeriodCore,
  basePeriod: Period,
  financeMonths: FinanceMonth[],
  today: Date,
  settings: MetricsSettings,
): { core: PeriodCore; aligned: Comparison["aligned"] } {
  const currentMonths = periodMonths(current.period);
  const confirmed = new Set(
    current.confirmation.confirmedMonths.map(monthIndex),
  );
  const allConfirmed = currentMonths.every((m) => confirmed.has(monthIndex(m)));

  if (allConfirmed || confirmed.size === 0) {
    return {
      core: computePeriodCore(basePeriod, financeMonths, today, settings),
      aligned: null,
    };
  }

  const baseMonths = periodMonths(basePeriod);
  const positions = currentMonths
    .map((m, i) => (confirmed.has(monthIndex(m)) ? i : -1))
    .filter((i) => i >= 0);
  const alignedBase = positions.map((i) => baseMonths[i]);
  return {
    core: computePeriodCore(
      basePeriod,
      financeMonths,
      today,
      settings,
      alignedBase,
    ),
    aligned: {
      current: positions.map((i) => currentMonths[i]),
      base: alignedBase,
    },
  };
}

function compare(
  current: PeriodCore,
  base: PeriodCore,
  aligned: Comparison["aligned"],
): Comparison {
  const rate = (now: bigint, before: bigint): Change => {
    if (!current.confirmation.hasData) {
      return { rate: null, reason: "no-current-data" };
    }
    return changeRate(now, base.confirmation.hasData ? before : null);
  };
  return {
    period: base.period,
    label: base.label,
    // 같은 월끼리 맞춰 비교하면 현재 쪽 미확정은 비교에 영향 없음 → 비교 기간 쪽 미확정만 남는다
    isPartial: aligned
      ? base.confirmation.isPartial
      : current.confirmation.isPartial || base.confirmation.isPartial,
    aligned,
    revenue: rate(current.revenue.total, base.revenue.total),
    expense: rate(current.expenses.total, base.expenses.total),
    profit: rate(current.profit.profit, base.profit.profit),
    profitDiff: profitDiff(current, base),
    margin: marginChange(current, base),
    revenueItems: itemChanges(current.revenue.items, base.revenue.items, rate),
    expenseItems: itemChanges(
      current.expenses.items,
      base.expenses.items,
      rate,
    ),
  };
}

function itemChanges(
  current: AmountShare[],
  base: AmountShare[],
  rate: (now: bigint, before: bigint) => Change,
): Record<string, Change> {
  return Object.fromEntries(
    current.map((item) => [
      item.key,
      rate(item.amount, base.find((b) => b.key === item.key)?.amount ?? 0n),
    ]),
  );
}

function profitDiff(current: PeriodCore, base: PeriodCore): AmountDiff {
  if (!current.confirmation.hasData)
    return { diff: null, reason: "no-current-data" };
  if (!base.confirmation.hasData) return { diff: null, reason: "no-data" };
  return { diff: current.profit.profit - base.profit.profit };
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
  const previous = baseCore(
    core,
    previousPeriod(period),
    financeMonths,
    today,
    settings,
  );
  const lastYear = baseCore(
    core,
    samePeriodLastYear(period),
    financeMonths,
    today,
    settings,
  );

  return {
    ...core,
    targets: computeTargets(period, input.annualTarget, financeMonths),
    annualProgress: computeAnnualProgress(
      period.year,
      input.annualTarget,
      financeMonths,
      today,
    ),
    changes: {
      previous: compare(core, previous.core, previous.aligned),
      lastYear: compare(core, lastYear.core, lastYear.aligned),
    },
    receivables: computeArReceivables(
      input.receivables,
      period,
      today,
      settings.expectedCollectionMonths,
    ),
    productivity: computeProductivity(core, input.annualTarget?.headcount),
  };
}
