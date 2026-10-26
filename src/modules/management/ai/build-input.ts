// AI 에 보낼 입력 만들기 (순수 함수): getManagementSummary 집계값만 사용
// - 거래처명·건별 미수 내역·비고·원본 월별 행은 넣지 않는다 (미수금은 금액·건수·구간만)
// - 생산팀 목업 비중(샘플 데이터)도 넣지 않는다 — AI 가 실제처럼 해석할 위험 (아래 TODO: 연동 시 추가)
// - 금액은 "7.09억원"·"6,668만원", 비율은 "12.3%", 목표·기대치 차이는 "82.4%로 17.6%p 부족"처럼 미리 계산해 AI 가 계산하지 않게 한다
// - 화면 headline·장기 미수 거래처명은 AI 에 보내지 않고 서버가 따로 만든다 (annotations.ts)
// - 오늘 날짜에 따라 바뀌는 값은 넣지 않는다 (끝난 분기는 같은 데이터면 같은 입력 → 같은 해시)
import { formatWonShort } from "@/shared/format/money";
import { periodMonths, type YearMonth } from "@/shared/period/period";

import type {
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
    amount: formatWonShort(i.amount),
    share: i.ratio === null ? "-" : pct(i.ratio),
  }));

/** 목표 − 실적: "1억 2,300만 원 부족" / "4,817만 원 초과" / "차이 없음" */
function amountDifference(target: bigint, actual: bigint): string {
  const diff = target - actual;
  if (diff === 0n) return "차이 없음";
  return diff > 0n
    ? `${formatWonShort(diff)} 부족`
    : `${formatWonShort(-diff)} 초과`;
}

const itemSum = (items: AmountShare[], keys: string[]) =>
  items
    .filter((i) => keys.includes(i.key))
    .reduce((total, i) => total + i.amount, 0n);

/** 분기 말까지 기대 매출 = 연간 목표 × (분기 수 ÷ 4), 원 단위 내림 */
export function expectedToDate(annualTarget: bigint, quarter: number): bigint {
  return (annualTarget * BigInt(quarter)) / 4n;
}

const amountCount = (v: { amount: bigint; count: number }) => ({
  amount: formatWonShort(v.amount),
  count: v.count,
});

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
      total: formatWonShort(revenue.total),
      items: shares(revenue.items),
    },
    expense: {
      total: formatWonShort(expenses.total),
      /** 매입 합계 = 상품 매입 + 원재료 매입 */
      purchaseTotal: formatWonShort(
        itemSum(expenses.items, ["goodsPurchase", "materialPurchase"]),
      ),
      /** 경비 합계 = 경비 + 그 외 지출 */
      operatingTotal: formatWonShort(
        itemSum(expenses.items, ["operatingExpense", "otherExpense"]),
      ),
      items: shares(expenses.items),
      otherDetail: shares(expenses.otherItems),
    },
    profit: {
      /** 추정 손익 (적자면 "-") */
      estimatedProfit: formatWonShort(profit.profit),
      margin: profit.margin === null ? "-" : pct(profit.margin),
      costBasis:
        profit.costMode === "purchases"
          ? "이익 = 매출 − 전체 지출(상품·원재료 매입 포함) — 적용 기준: 매입액 = 원가, 공급가액"
          : "이익 = 매출 − (경비 + 그 외 지출), 매입 제외 — 참고 기준",
    },
    changes: {
      previousQuarter: comparison(summary.changes.previous, revenueLabels),
      sameQuarterLastYear: comparison(summary.changes.lastYear, revenueLabels),
    },
    target:
      targets.annual && targets.quarterTargets && targets.period
        ? {
            quarterTarget: formatWonShort(targets.period.target),
            quarterTargetSource:
              targets.quarterTargets.sources[quarterIndex] === "input"
                ? "직접 입력"
                : "연간 목표에서 자동 배분",
            quarterActual: formatWonShort(targets.period.actual),
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
            annualTarget: formatWonShort(targets.annual.target),
            /** 1월 ~ 이번 분기 말까지 확정 매출 누적 */
            cumulativeActualToQuarterEnd: formatWonShort(targets.annual.actual),
            /** 이번 분기 말 기준 연간 경과율(분기 수 ÷ 4) 대비 진도 */
            annualProgress:
              targets.annual.rate === null
                ? "비교 불가 (연간 목표가 0원)"
                : progressText(targets.annual.rate, quarter.quarter / 4),
            /** 기간 경과 기준 기대치 = 연간 목표 × 경과율 */
            expectedToQuarterEnd: formatWonShort(
              expectedToDate(targets.annual.target, quarter.quarter),
            ),
            /** 기대치 − 누적 실적: "3.80억원 부족" / "초과" */
            gapVsExpected: amountDifference(
              expectedToDate(targets.annual.target, quarter.quarter),
              targets.annual.actual,
            ),
          }
        : "연간 목표 미설정",
    // TODO(생산팀 연동): 판매처 산업분야·제품 시리즈 비중은 연동 전까지 넣지 않는다 (목업 = 가짜 비중).
    // 연동 후 getSalesShareByIndustry / getSalesShareBySeries(quarter) 결과를 아래 형태로 추가하면
    // 프롬프트 7번 규칙(is_sample 이면 "샘플 데이터 기준")이 그대로 적용된다:
    //   industryShares: { is_sample: source === "mock", items: [{ item, amount: formatWonShort(..), share: pct(..) }] },
    //   seriesShares:   { is_sample: ..., items: [...] },
    // 미수금 = 채권·채무 외상매출금 기준월 (2026-10-26, 05-22) — 거래처명은 보내지 않음 (05-19)
    receivables: {
      basis: "채권·채무 관리 외상매출금 — 미수 = 장기미수 + 당월 수금예정",
      baseMonth: receivables.month
        ? `${receivables.month.year}년 ${receivables.month.month}월`
        : "입력 없음",
      asOf: receivables.asOf.toISOString().slice(0, 10),
      total: formatWonShort(receivables.total),
      count: receivables.count,
      /** 장기미수 (담당자가 정한 구분) */
      longOverdue: amountCount(receivables.longOverdue),
      scheduled: amountCount(receivables.scheduled),
      /** 기준월에 받은 돈 (미수에 넣지 않음) */
      collectedThisMonth: amountCount(receivables.collected),
      pastDue: amountCount(receivables.expected.overdue),
      noDueDate: amountCount(receivables.expected.noDueDate),
      expectedCollections: receivables.expected.months
        .filter((m) => m.count > 0)
        .map((m) => ({
          month: `${m.year}년 ${m.month}월`,
          amount: formatWonShort(m.amount),
          count: m.count,
        })),
    },
  };
}
