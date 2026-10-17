// AI 에 보낼 입력 만들기 (순수 함수): getManagementSummary 집계값만 사용
// - 거래처명·건별 미수 내역·비고·원본 월별 행은 넣지 않는다 (미수금은 금액·건수·구간만)
// - 생산팀 목업 비중(샘플 데이터)도 넣지 않는다 — AI 가 실제처럼 해석할 위험
// - 금액은 "1,234,000원", 비율은 "12.3%"로 미리 계산해 AI 가 계산하지 않게 한다
// - 오늘 날짜에 따라 바뀌는 값은 넣지 않는다 (끝난 분기는 같은 데이터면 같은 입력 → 같은 해시)
import { formatWon } from "@/shared/format/money";
import { periodMonths, type YearMonth } from "@/shared/period/period";

import type {
  AgingBucket,
  AmountShare,
  Change,
  Comparison,
  ManagementSummary,
  MarginChange,
} from "../metrics/types";
import type { QuarterPeriod } from "./rules";

const pct = (ratio: number, digits = 1) => `${(ratio * 100).toFixed(digits)}%`;
const signedPct = (ratio: number) =>
  `${ratio >= 0 ? "+" : ""}${(ratio * 100).toFixed(1)}%`;
const monthsLabel = (months: YearMonth[]) =>
  months.map((m) => `${m.year}년 ${m.month}월`).join(", ");

const CHANGE_REASON: Record<NonNullable<Change["reason"]>, string> = {
  "no-current-data": "비교 불가 (이번 분기 확정 데이터 없음)",
  "no-data": "비교 불가 (비교 기간 확정 데이터 없음)",
  "zero-base": "비교 불가 (비교 기간 값이 0원)",
};
const MARGIN_REASON: Record<NonNullable<MarginChange["reason"]>, string> = {
  "no-current-data": "비교 불가 (이번 분기 확정 데이터 없음)",
  "no-data": "비교 불가 (비교 기간 확정 데이터 없음)",
  "no-margin": "비교 불가 (매출이 0원이라 이익률 없음)",
};

const changeText = (c: Change) =>
  c.rate === null ? CHANGE_REASON[c.reason ?? "no-data"] : signedPct(c.rate);
const marginText = (m: MarginChange) =>
  m.diff === null
    ? MARGIN_REASON[m.reason ?? "no-data"]
    : `${m.diff >= 0 ? "+" : ""}${(m.diff * 100).toFixed(1)}%p`;

const shares = (items: AmountShare[]) =>
  items.map((i) => ({
    item: i.label,
    amount: formatWon(i.amount),
    share: i.ratio === null ? "-" : pct(i.ratio),
  }));

const BUCKET_LABEL: Record<AgingBucket, string> = {
  "0-30": "0~30일",
  "31-60": "31~60일",
  "61-90": "61~90일",
  "90+": "90일 초과",
};

function comparison(c: Comparison) {
  return {
    basePeriod: c.label,
    /** 이번 분기에 확정 안 된 달이 있어 같은 순서의 달끼리만 비교한 경우 */
    sameMonthsOnly: c.aligned
      ? {
          current: monthsLabel(c.aligned.current),
          base: monthsLabel(c.aligned.base),
        }
      : null,
    basePartiallyConfirmed: c.isPartial,
    revenue: changeText(c.revenue),
    expense: changeText(c.expense),
    profit: changeText(c.profit),
    marginDiff: marginText(c.margin),
    revenueByItem: Object.fromEntries(
      Object.entries(c.revenueItems).map(([k, v]) => [k, changeText(v)]),
    ),
  };
}

/** AI 입력 (이 객체 그대로 JSON 으로 보내고, 해시도 이 객체로 계산) */
export type AiInput = ReturnType<typeof buildAiInput>;

export function buildAiInput(
  summary: ManagementSummary,
  quarter: QuarterPeriod,
) {
  const { confirmation, revenue, expenses, profit, targets, receivables } =
    summary;
  const quarterIndex = quarter.quarter - 1;

  return {
    period: summary.label,
    months: monthsLabel(periodMonths(quarter)),
    confirmation: {
      confirmedMonths: monthsLabel(confirmation.confirmedMonths),
      unconfirmedMonths: confirmation.unconfirmedMonths.map((m) => ({
        month: `${m.year}년 ${m.month}월`,
        reason: m.reason === "DRAFT" ? "임시저장(미확정)" : "입력 없음",
      })),
      /** 미확정 달이 있어 일부 달만 집계됨 */
      partial: confirmation.isPartial,
    },
    revenue: { total: formatWon(revenue.total), items: shares(revenue.items) },
    expense: {
      total: formatWon(expenses.total),
      items: shares(expenses.items),
      otherDetail: shares(expenses.otherItems),
    },
    profit: {
      profit: formatWon(profit.profit),
      margin: profit.margin === null ? "-" : pct(profit.margin),
      costBasis:
        profit.costMode === "purchases"
          ? "이익 = 매출 − 전체 지출(상품·원재료 매입 포함) — 임시 기준, 고객사 확인 중"
          : "이익 = 매출 − (경비 + 그 외 지출), 매입 제외 — 참고 기준",
    },
    changes: {
      previousQuarter: comparison(summary.changes.previous),
      sameQuarterLastYear: comparison(summary.changes.lastYear),
    },
    target:
      targets.annual && targets.quarterTargets && targets.period
        ? {
            quarterTarget: formatWon(targets.period.target),
            quarterTargetSource:
              targets.quarterTargets.sources[quarterIndex] === "input"
                ? "직접 입력"
                : "연간 목표에서 자동 배분",
            quarterActual: formatWon(targets.period.actual),
            quarterAchievement:
              targets.period.rate === null ? "-" : pct(targets.period.rate),
            annualTarget: formatWon(targets.annual.target),
            /** 1월 ~ 이번 분기 말까지 확정 매출 누적 */
            cumulativeActualToQuarterEnd: formatWon(targets.annual.actual),
            annualAchievement:
              targets.annual.rate === null ? "-" : pct(targets.annual.rate),
            /** 이번 분기 말 기준 연간 경과율 (분기 수 ÷ 4) */
            elapsedRatio: pct(quarter.quarter / 4, 0),
            progressGap:
              targets.annual.rate === null
                ? "-"
                : `${targets.annual.rate - quarter.quarter / 4 >= 0 ? "+" : ""}${((targets.annual.rate - quarter.quarter / 4) * 100).toFixed(1)}%p (연간 달성률 − 경과율)`,
          }
        : "연간 목표 미설정",
    receivables: {
      asOf: receivables.asOf.toISOString().slice(0, 10),
      total: formatWon(receivables.total),
      count: receivables.count,
      agingBasis: "경과일은 발생일부터 계산",
      aging: receivables.aging.map((a) => ({
        bucket: BUCKET_LABEL[a.bucket],
        amount: formatWon(a.amount),
        count: a.count,
      })),
      pastDue: {
        amount: formatWon(receivables.expected.overdue.amount),
        count: receivables.expected.overdue.count,
      },
      noDueDate: {
        amount: formatWon(receivables.expected.noDueDate.amount),
        count: receivables.expected.noDueDate.count,
      },
      expectedCollections: receivables.expected.months
        .filter((m) => m.count > 0)
        .map((m) => ({
          month: `${m.year}년 ${m.month}월`,
          amount: formatWon(m.amount),
          count: m.count,
        })),
    },
  };
}
