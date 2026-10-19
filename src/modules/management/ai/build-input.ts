// AI 에 보낼 입력 만들기 (순수 함수): getManagementSummary 집계값만 사용
// - 거래처명·건별 미수 내역·비고·원본 월별 행은 넣지 않는다 (미수금은 금액·건수·구간만)
// - 생산팀 목업 비중(샘플 데이터)도 넣지 않는다 — AI 가 실제처럼 해석할 위험 (아래 TODO: 연동 시 추가)
// - 금액은 "1억 2,300만 원", 비율은 "12.3%", 목표 차이는 "82.4%로 17.6%p 부족"처럼 미리 계산해 AI 가 계산하지 않게 한다
// - 오늘 날짜에 따라 바뀌는 값은 넣지 않는다 (끝난 분기는 같은 데이터면 같은 입력 → 같은 해시)
import { formatWonKorean } from "@/shared/format/money";
import { periodMonths, type YearMonth } from "@/shared/period/period";

import type {
  AgingBucket,
  AmountShare,
  Change,
  Comparison,
  ManagementSummary,
  MarginChange,
} from "../metrics/types";
import { achievementText, progressText } from "./phrases";
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
    amount: formatWonKorean(i.amount),
    share: i.ratio === null ? "-" : pct(i.ratio),
  }));

/** 목표 − 실적: "1억 2,300만 원 부족" / "4,817만 원 초과" / "차이 없음" */
function amountDifference(target: bigint, actual: bigint): string {
  const diff = target - actual;
  if (diff === 0n) return "차이 없음";
  return diff > 0n
    ? `${formatWonKorean(diff)} 부족`
    : `${formatWonKorean(-diff)} 초과`;
}

const BUCKET_LABEL: Record<AgingBucket, string> = {
  "0-30": "0~30일",
  "31-60": "31~60일",
  "61-90": "61~90일",
  "90+": "90일 초과",
};

/** @param labels 항목 key → 한글 이름 (AI 가 "goods" 같은 내부 키를 쓰지 않게) */
function comparison(c: Comparison, labels: Map<string, string>) {
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
      Object.entries(c.revenueItems).map(([k, v]) => [
        labels.get(k) ?? k,
        changeText(v),
      ]),
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
  const revenueLabels = new Map(revenue.items.map((i) => [i.key, i.label]));

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
    revenue: {
      total: formatWonKorean(revenue.total),
      items: shares(revenue.items),
    },
    expense: {
      total: formatWonKorean(expenses.total),
      items: shares(expenses.items),
      otherDetail: shares(expenses.otherItems),
    },
    profit: {
      profit: formatWonKorean(profit.profit),
      margin: profit.margin === null ? "-" : pct(profit.margin),
      costBasis:
        profit.costMode === "purchases"
          ? "이익 = 매출 − 전체 지출(상품·원재료 매입 포함) — 임시 기준, 고객사 확인 중"
          : "이익 = 매출 − (경비 + 그 외 지출), 매입 제외 — 참고 기준",
    },
    changes: {
      previousQuarter: comparison(summary.changes.previous, revenueLabels),
      sameQuarterLastYear: comparison(summary.changes.lastYear, revenueLabels),
    },
    target:
      targets.annual && targets.quarterTargets && targets.period
        ? {
            quarterTarget: formatWonKorean(targets.period.target),
            quarterTargetSource:
              targets.quarterTargets.sources[quarterIndex] === "input"
                ? "직접 입력"
                : "연간 목표에서 자동 배분",
            quarterActual: formatWonKorean(targets.period.actual),
            /** "82.4%로 17.6%p 부족" / "105.2%로 5.2%p 초과" */
            quarterAchievement:
              targets.period.rate === null
                ? "비교 불가 (분기 목표가 0원)"
                : achievementText(targets.period.rate),
            /** 분기 목표와 실적의 금액 차이 */
            quarterDifference: amountDifference(
              targets.period.target,
              targets.period.actual,
            ),
            annualTarget: formatWonKorean(targets.annual.target),
            /** 1월 ~ 이번 분기 말까지 확정 매출 누적 */
            cumulativeActualToQuarterEnd: formatWonKorean(
              targets.annual.actual,
            ),
            /** 이번 분기 말 기준 연간 경과율(분기 수 ÷ 4) 대비 진도 */
            annualProgress:
              targets.annual.rate === null
                ? "비교 불가 (연간 목표가 0원)"
                : progressText(targets.annual.rate, quarter.quarter / 4),
          }
        : "연간 목표 미설정",
    // TODO(생산팀 연동): 판매처 산업분야·제품 시리즈 비중은 연동 전까지 넣지 않는다 (목업 = 가짜 비중).
    // 연동 후 getSalesShareByIndustry / getSalesShareBySeries(quarter) 결과를 아래 형태로 추가하면
    // 프롬프트 7번 규칙(is_sample 이면 "샘플 데이터 기준")이 그대로 적용된다:
    //   industryShares: { is_sample: source === "mock", items: [{ item, amount: formatWonKorean(..), share: pct(..) }] },
    //   seriesShares:   { is_sample: ..., items: [...] },
    receivables: {
      asOf: receivables.asOf.toISOString().slice(0, 10),
      total: formatWonKorean(receivables.total),
      count: receivables.count,
      agingBasis: "경과일은 발생일부터 계산",
      aging: receivables.aging.map((a) => ({
        bucket: BUCKET_LABEL[a.bucket],
        amount: formatWonKorean(a.amount),
        count: a.count,
      })),
      pastDue: {
        amount: formatWonKorean(receivables.expected.overdue.amount),
        count: receivables.expected.overdue.count,
      },
      noDueDate: {
        amount: formatWonKorean(receivables.expected.noDueDate.amount),
        count: receivables.expected.noDueDate.count,
      },
      expectedCollections: receivables.expected.months
        .filter((m) => m.count > 0)
        .map((m) => ({
          month: `${m.year}년 ${m.month}월`,
          amount: formatWonKorean(m.amount),
          count: m.count,
        })),
    },
  };
}
