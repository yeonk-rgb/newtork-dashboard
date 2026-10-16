// 목표 달성률. 분기 목표 배분 규칙은 CLAUDE.md "구현 메모" 참고
import { periodMonths, quarterOf, type Period } from "@/shared/period/period";

import { ratio, sum } from "./math";
import { monthRevenue } from "./revenue";
import type {
  AnnualProgress,
  AnnualTargetInput,
  FinanceMonth,
  QuarterTargets,
  TargetProgress,
  TargetResult,
} from "./types";

/**
 * 분기 목표 배분
 * - 비어 있는 분기 = (연간 − 입력한 분기 합) ÷ 빈 분기 수, 나머지 원은 마지막 빈 분기에
 * - 입력한 분기 합이 연간보다 크면 빈 분기는 0 + 경고
 * - 4개 모두 입력했는데 합계 ≠ 연간이면 경고 (입력값 그대로 사용)
 */
export function allocateQuarterTargets(
  target: AnnualTargetInput,
): QuarterTargets {
  const filled = target.quarterTargets.filter((q): q is bigint => q !== null);
  const emptyIndexes = target.quarterTargets
    .map((q, i) => (q === null ? i : -1))
    .filter((i) => i >= 0);
  const filledSum = sum(filled);
  const quarters = target.quarterTargets.map(
    (q) => q ?? 0n,
  ) as QuarterTargets["quarters"];
  const sources = target.quarterTargets.map((q) =>
    q === null ? "allocated" : "input",
  ) as QuarterTargets["sources"];

  if (emptyIndexes.length === 0) {
    return filledSum === target.revenueTarget
      ? { quarters, sources }
      : { quarters, sources, warning: "QUARTER_SUM_MISMATCH" };
  }

  const remaining = target.revenueTarget - filledSum;
  if (remaining < 0n) {
    return { quarters, sources, warning: "QUARTER_SUM_EXCEEDS_ANNUAL" };
  }

  const count = BigInt(emptyIndexes.length);
  const base = remaining / count;
  const rest = remaining % count;
  emptyIndexes.forEach((index, i) => {
    quarters[index] = i === emptyIndexes.length - 1 ? base + rest : base;
  });
  return { quarters, sources };
}

function progress(target: bigint, actual: bigint): TargetProgress {
  return { target, actual, rate: ratio(actual, target) };
}

/**
 * @param yearMonths 해당 연도의 확정된 월 데이터 (집계 대상)
 */
export function computeTargets(
  period: Period,
  target: AnnualTargetInput | null,
  yearMonths: FinanceMonth[],
): TargetResult {
  if (!target) {
    return {
      annual: null,
      period: null,
      quarterTargets: null,
      quarterActuals: null,
    };
  }

  const confirmed = yearMonths.filter(
    (m) => m.status === "CONFIRMED" && m.year === period.year,
  );
  const revenueBetween = (fromMonth: number, toMonth: number) =>
    sum(
      confirmed
        .filter((m) => m.month >= fromMonth && m.month <= toMonth)
        .map(monthRevenue),
    );

  const months = periodMonths(period);
  const lastMonth = months.at(-1)!.month;
  const quarterTargets = allocateQuarterTargets(target);
  const annual = progress(target.revenueTarget, revenueBetween(1, lastMonth));

  let periodTarget: TargetResult["period"];
  switch (period.unit) {
    case "quarter": {
      const first = (period.quarter - 1) * 3 + 1;
      periodTarget = {
        kind: "quarter",
        ...progress(
          quarterTargets.quarters[period.quarter - 1],
          revenueBetween(first, first + 2),
        ),
      };
      break;
    }
    case "month": {
      const quarter = quarterOf(period.month);
      const first = (quarter - 1) * 3 + 1;
      periodTarget = {
        kind: "quarter-progress",
        ...progress(
          quarterTargets.quarters[quarter - 1],
          revenueBetween(first, period.month),
        ),
      };
      break;
    }
    case "year":
      periodTarget = { kind: "annual", ...annual };
      break;
    case "ytd":
      periodTarget = {
        kind: "ytd-prorated",
        ...progress(
          (target.revenueTarget * BigInt(period.month)) / 12n,
          revenueBetween(1, period.month),
        ),
      };
      break;
  }

  const quarterActuals = [1, 4, 7, 10].map((first) =>
    revenueBetween(first, first + 2),
  ) as [bigint, bigint, bigint, bigint];

  return { annual, period: periodTarget, quarterTargets, quarterActuals };
}

/**
 * 연간 목표 대비 확정 누적 실적 + 연간 경과율 (선택 기간과 무관)
 * 경과율은 실적과 같은 기준이 되도록 "확정된 마지막 달 ÷ 12"
 */
export function computeAnnualProgress(
  year: number,
  target: AnnualTargetInput | null,
  months: FinanceMonth[],
  today: Date,
): AnnualProgress | null {
  if (!target || target.year !== year) return null;

  const confirmed = months.filter(
    (m) => m.year === year && m.status === "CONFIRMED",
  );
  const confirmedMonths = confirmed.map((m) => m.month).sort((a, b) => a - b);
  const actual = sum(confirmed.map(monthRevenue));
  const remaining = target.revenueTarget - actual;
  const basisMonth = confirmedMonths.at(-1) ?? 0;

  // 이미 마감된 달 (올해: 이번 달 전까지, 지난해: 12월까지, 미래: 없음)
  const todayYear = today.getUTCFullYear();
  const closedThrough =
    year < todayYear ? 12 : year > todayYear ? 0 : today.getUTCMonth();
  const isConfirmed = new Set(confirmedMonths);
  const unconfirmedClosed = Array.from(
    { length: closedThrough },
    (_, i) => i + 1,
  ).filter((m) => !isConfirmed.has(m));

  return {
    year,
    target: target.revenueTarget,
    actual,
    remaining: remaining > 0n ? remaining : 0n,
    rate: ratio(actual, target.revenueTarget),
    basisMonth,
    elapsedRatio: basisMonth / 12,
    confirmedMonths,
    excludedMonths: unconfirmedClosed.filter((m) => m > basisMonth),
    gapMonths: unconfirmedClosed.filter((m) => m < basisMonth),
  };
}
