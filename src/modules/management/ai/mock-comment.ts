// 개발용 모의 응답 (AI_MOCK=true) — API 키 없이 화면 흐름을 확인할 때만 쓴다
// 입력 수치를 그대로 옮겨 적은 고정 문장이며, 실제 분석이 아님을 문장에 표시한다
// 프롬프트 9번(미확정 월 언급)·10번(비교 불가는 숫자 없이) 규칙이 화면에서 어떻게 보일지 확인할 수 있게 따른다
import type { AiInput } from "./build-input";
import type { AiCommentResponse } from "./schemas";

export const MOCK_MODEL = "mock";

const isUnavailable = (text: string) => text.startsWith("비교 불가");

export function mockAiComment(input: AiInput): AiCommentResponse {
  const target = typeof input.target === "string" ? null : input.target;
  const unconfirmed = input.confirmation.unconfirmedMonths
    .map((m) => m.month.replace(/^\d{4}년 /, ""))
    .join("·");
  const previous = input.changes.previousQuarter.revenue;
  const lastYear = input.changes.sameQuarterLastYear.revenue;

  const summary = [
    target
      ? `[모의] 분기 목표 대비 ${target.quarterAchievement}입니다.`
      : `[모의] 연간 목표가 없어 달성률을 계산할 수 없습니다.`,
    target
      ? `[모의] ${target.annualProgress}입니다.`
      : `[모의] 확정 매출은 ${input.revenue.total}입니다.`,
    unconfirmed
      ? `[모의] ${unconfirmed}은 미확정이라 집계에서 빠졌습니다.`
      : `[모의] 확정 매출은 ${input.revenue.total}입니다.`,
  ];

  const shortfalls: string[] = [];
  if (target?.quarterAchievement.includes("부족")) {
    shortfalls.push(
      `[모의] 분기 매출이 목표보다 ${target.quarterDifference}합니다.`,
    );
  }
  if (!isUnavailable(previous) && previous.startsWith("-")) {
    shortfalls.push(`[모의] 매출이 직전 분기 대비 ${previous} 감소했습니다.`);
  }

  return {
    summary,
    shortfalls,
    improvements: [
      isUnavailable(lastYear)
        ? "[모의] 전년 동기는 데이터가 없어 비교할 수 없습니다."
        : `[모의] 전년 동기 대비 ${lastYear} 변화의 원인을 확인합니다.`,
      unconfirmed
        ? `[모의] ${unconfirmed} 실적을 확정해 분석을 갱신합니다.`
        : "[모의] 실제 분석은 API 키를 넣고 AI_MOCK을 끈 뒤 확인합니다.",
    ],
  };
}
