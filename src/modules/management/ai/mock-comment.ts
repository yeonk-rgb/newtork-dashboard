// 개발용 모의 응답 (AI_MOCK=true) — API 키 없이 화면 흐름을 확인할 때만 쓴다
// 입력 수치를 그대로 옮겨 적은 고정 문장이며, 실제 분석이 아님을 문장에 표시한다
import type { AiInput } from "./build-input";
import type { AiCommentResult } from "./schemas";

export const MOCK_MODEL = "mock";

export function mockAiComment(input: AiInput): AiCommentResult {
  const unconfirmed = input.confirmation.unconfirmedMonths
    .map((m) => m.month)
    .join(", ");
  const target =
    typeof input.target === "string"
      ? "연간 목표가 설정되지 않았습니다."
      : `분기 목표 달성률은 ${input.target.quarterAchievement}입니다.`;
  return {
    summary: `[모의 응답] ${input.period} 확정 매출은 ${input.revenue.total}이며 직전 분기 대비 ${input.changes.previousQuarter.revenue}입니다. ${target}${unconfirmed ? ` ${unconfirmed}은 미확정이라 집계에서 빠졌습니다.` : ""}`,
    weaknesses: [
      `[모의 응답] 이익률은 ${input.profit.margin}입니다.`,
      `[모의 응답] 미수금은 ${input.receivables.total}(${input.receivables.count}건)입니다.`,
    ],
    improvements: [
      "[모의 응답] 실제 분석은 API 키를 넣고 AI_MOCK 을 끈 뒤 [다시 분석]으로 확인하세요.",
    ],
  };
}
