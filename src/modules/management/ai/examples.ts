// 대시보드 예시 AI 분석 (순수 함수): 시드 데이터로 계산한 지표에서 문장을 만든다
// - 숫자는 모두 서버 계산값(ManagementSummary·buildAiInput·formatWonShort)에서 가져오고, 문장 틀만 정해져 있다
// - 프롬프트 규칙을 따른다: 60자, 금액 표기, 보고서체 평서문, 부족한 점과 개선 제안 짝, 미확정 월 언급, 비교 불가 처리, 추측 금지
// - 저장은 scripts/seed-ai-examples.ts (npm run seed:ai-examples). 고객사 실제 데이터 사용 전에는 지운다
import { formatWonShort } from "@/shared/format/money";

import type { Change, ManagementSummary } from "../metrics/types";
import { buildAiInput, expectedToDate } from "./build-input";
import type { QuarterPeriod } from "./rules";
import type { AiCommentResponse } from "./schemas";

/** 저장되는 생성 방식 (카드 오른쪽 위 "예시 · 생성일시") */
export const EXAMPLE_MODEL = "example";
export const EXAMPLE_ID_PREFIX = "ai-example-";
export const exampleId = (year: number, quarter: number) =>
  `${EXAMPLE_ID_PREFIX}${year}-q${quarter}`;

/** 서로 다른 상황의 예시 — 시드 전체 분기 (기본 화면 = 마지막으로 끝난 2026년 3분기도 누르지 않고 보이게, 2026-10-28) */
export const EXAMPLE_QUARTERS = [
  {
    quarter: { unit: "quarter", year: 2026, quarter: 2 },
    situation: "a) 목표 미달 + 장기 미수금",
  },
  {
    quarter: { unit: "quarter", year: 2025, quarter: 1 },
    situation: "b) 목표 초과 달성",
  },
  {
    quarter: { unit: "quarter", year: 2025, quarter: 2 },
    situation: "c) 전 분기 대비 감소",
  },
  {
    quarter: { unit: "quarter", year: 2024, quarter: 4 },
    situation: "d) 전 분기와 비교 불가 (시드 첫 분기)",
  },
  {
    quarter: { unit: "quarter", year: 2025, quarter: 3 },
    situation: "e) 목표 소폭 초과 + 전 분기 대비 증가",
  },
  {
    quarter: { unit: "quarter", year: 2025, quarter: 4 },
    situation: "f) 분기 목표는 미달, 연간 목표는 초과 달성",
  },
  {
    quarter: { unit: "quarter", year: 2026, quarter: 1 },
    situation: "g) 새해 첫 분기, 목표 미달 + 소폭 감소",
  },
  {
    quarter: { unit: "quarter", year: 2026, quarter: 3 },
    situation: "h) 마지막으로 끝난 분기 (미확정 달이 있으면 같은 달끼리 비교)",
  },
] as const satisfies readonly { quarter: QuarterPeriod; situation: string }[];

/** 0.134 → "13.4%" (부호 없이) */
const absPct = (rate: number) => `${Math.abs(rate * 100).toFixed(1)}%`;
/** 금액 뒤 조사: "…억원을/만원을/0원을" — 표기가 모두 "원"으로 끝나므로 "을" */
const obj = (amount: string) => `${amount}을`;

/** 전 분기 대비 문장 (비교 불가면 숫자 없이) */
function changeSentence(label: string, change: Change): string {
  if (change.rate === null) {
    return `${label} 확정 데이터가 없어 비교할 수 없습니다.`;
  }
  if (change.rate === 0) return `${label} 대비 매출 변동이 없습니다.`;
  return `${label} 대비 매출이 ${absPct(change.rate)} ${change.rate > 0 ? "증가" : "감소"}했습니다.`;
}

/** 전 분기 대비 가장 많이 줄어든/늘어난 매출 항목 (비교 가능한 것만) */
function extremeItem(summary: ManagementSummary, direction: "down" | "up") {
  const changes = summary.changes.previous.revenueItems;
  return summary.revenue.items
    .map((item) => ({
      label: item.label,
      rate: changes[item.key]?.rate ?? null,
    }))
    .filter((i): i is { label: string; rate: number } => i.rate !== null)
    .filter((i) => (direction === "down" ? i.rate < 0 : i.rate > 0))
    .sort((a, b) =>
      direction === "down" ? a.rate - b.rate : b.rate - a.rate,
    )[0];
}

/** 시드 지표로 예시 분석 문장 (AI 응답과 같은 형식) */
export function buildExampleComment(
  summary: ManagementSummary,
  quarter: QuarterPeriod,
): AiCommentResponse {
  const input = buildAiInput(summary, quarter);
  const q = `${quarter.quarter}분기`;
  const item = (label: string) =>
    input.revenue.items.find((i) => i.item === label)?.amount ?? "0원";
  const previous = summary.changes.previous;
  const unconfirmed = input.confirmation.unconfirmedMonths
    .map((m) => m.month.replace(/^\d{4}년 /, ""))
    .join("·");
  const quarterTarget = summary.targets.period;
  const exceeded = quarterTarget?.rate != null && quarterTarget.rate >= 1;

  // ---------- 이번 기간 현황 ----------
  const summarySentences = [
    `${q} 매출은 ${input.revenue.total}(제품 ${item("제품 매출")}, 상품 ${item("상품 매출")}, 용역 ${item("용역 매출")})입니다.`,
    // 9번 규칙: 미확정 달이 있으면 같은 달끼리 비교했다고 밝힌다
    unconfirmed && previous.revenue.rate !== null
      ? `${unconfirmed} 미확정, 같은 달끼리 ${previous.label} 대비 ${absPct(previous.revenue.rate)} ${previous.revenue.rate >= 0 ? "증가" : "감소"}했습니다.`
      : changeSentence(previous.label, previous.revenue),
    exceeded && quarterTarget
      ? `분기 목표 ${formatWonShort(quarterTarget.target)}의 ${absPct(quarterTarget.rate!)}로 초과 달성했습니다.`
      : `매입·경비 합계는 ${formatWonShort(summary.expenses.total)}, 추정 손익은 ${formatWonShort(summary.profit.profit)}입니다.`,
  ];

  // ---------- 부족한 점·주의 ↔ 다음 분기 개선할 점 (같은 순서로 짝) ----------
  const pairs: [string, string][] = [];
  const annual = summary.targets.annual;
  if (annual) {
    const expected = expectedToDate(annual.target, quarter.quarter);
    const gap = expected - annual.actual;
    if (gap > 0n && expected > 0n) {
      const progress = Number(annual.actual) / Number(expected);
      pairs.push([
        `기간 경과 기대치보다 ${formatWonShort(gap)} 부족합니다(진도율 ${absPct(progress)}).`,
        `분기 초 수주 잔고를 점검해 부족분 ${obj(formatWonShort(gap))} 월별로 배정합니다.`,
      ]);
    }
  }
  if (!exceeded && quarterTarget?.rate != null && pairs.length === 0) {
    pairs.push([
      `분기 목표 대비 ${absPct(quarterTarget.rate)}로 목표에 못 미쳤습니다.`,
      "월별 수주 실적을 분기 목표와 매달 대조합니다.",
    ]);
  }
  const decline = previous.revenue.rate !== null && previous.revenue.rate < 0;
  const down = decline ? extremeItem(summary, "down") : undefined;
  if (decline && down) {
    pairs.push([
      `${down.label}이 ${previous.label} 대비 ${absPct(down.rate)} 줄었습니다.`,
      `${down.label} 거래처별 발주 추이를 확인합니다.`,
    ]);
  }
  const longOverdue = input.receivables.longOverdue;
  if (longOverdue.count > 0) {
    pairs.push([
      `장기 미수금이 ${longOverdue.amount}(${longOverdue.count}건)입니다.`,
      `장기 미수금 ${longOverdue.count}건의 수금 일정을 거래처별로 확정합니다.`,
    ]);
  }
  const top = pairs.slice(0, 3);

  const improvements = top.map(([, fix]) => fix);
  if (improvements.length < 3) {
    const up =
      previous.revenue.rate !== null ? extremeItem(summary, "up") : undefined;
    improvements.push(
      unconfirmed
        ? `${unconfirmed} 실적을 확정한 뒤 분석을 갱신합니다.`
        : up
          ? `증가 폭이 큰 ${up.label}의 다음 분기 발주 계획을 미리 확인합니다.`
          : "다음 분기 월별 수주 계획을 분기 목표에 맞춰 점검합니다.",
    );
  }

  return {
    summary: summarySentences,
    shortfalls: top.map(([issue]) => issue),
    improvements,
  };
}
