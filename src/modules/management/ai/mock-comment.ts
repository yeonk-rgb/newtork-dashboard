// 개발용 모의 응답 (AI_MOCK=true) — API 키 없이 화면 흐름을 확인할 때만 쓴다
// 입력 수치를 정해진 문장에 끼워 넣은 것이며, 실제 분석이 아님을 문장에 표시한다
// 카드의 3단(이번 기간 현황 / 부족한 점·주의 / 다음 분기 개선할 점)이 모두 채워지도록,
// 프롬프트의 규칙(9 미확정 월, 10 비교 불가, 11 거래처명 없음, 개선 제안 짝 맞추기)을 따른다
import type { AiInput } from "./build-input";
import type { AiCommentResponse } from "./schemas";

export const MOCK_MODEL = "mock";

const isUnavailable = (text: string) => text.startsWith("비교 불가");

export function mockAiComment(input: AiInput): AiCommentResponse {
  const target = typeof input.target === "string" ? null : input.target;
  const unconfirmed = input.confirmation.unconfirmedMonths
    .map((m) => m.month.replace(/^\d{4}년 /, ""))
    .join("·");
  const item = (label: string) =>
    input.revenue.items.find((i) => i.item === label)?.amount ?? "0원";
  const previous = input.changes.previousQuarter.revenue;

  const summary = [
    `[모의] 매출 ${input.revenue.total}(제품 ${item("제품 매출")}·상품 ${item("상품 매출")}·용역 ${item("용역 매출")})입니다.`,
    // 9번 규칙: 미확정 달이 있으면 그 사실과 같은 달끼리 비교했다는 점을 함께 쓴다
    unconfirmed && !isUnavailable(previous)
      ? `[모의] ${unconfirmed} 미확정, 같은 달끼리 전 분기 대비 ${previous}입니다.`
      : unconfirmed
        ? `[모의] ${unconfirmed} 미확정, 전 분기와는 비교할 수 없습니다.`
        : isUnavailable(previous)
          ? "[모의] 전 분기와는 비교할 수 없습니다."
          : `[모의] 전 분기 대비 매출이 ${previous} 변했습니다.`,
    // 13번 규칙: 생산·서비스 숫자가 있으면 한 문장 (샘플이면 밝힌다)
    input.teams?.production && input.teams.service
      ? `[모의] 생산 확정 출고 ${input.teams.production.confirmedShipped}, 서비스 출장 ${input.teams.service.trips}입니다${input.teams.production.is_sample || input.teams.service.is_sample ? "(샘플 데이터 기준)" : ""}.`
      : `[모의] 매입 ${input.expense.purchaseTotal}·경비 ${input.expense.operatingTotal}, 추정 손익 ${input.profit.estimatedProfit}입니다.`,
  ];

  // 부족한 점과 개선 제안은 같은 순서로 짝을 맞춘다
  const pairs: [string, string][] = [];
  if (target?.gapVsExpected.endsWith("부족")) {
    pairs.push([
      `[모의] 기대치 대비 ${target.gapVsExpected}입니다.`,
      "[모의] 부족분만큼 수주·출하 일정을 앞당겨 점검합니다.",
    ]);
  }
  const { longOverdue } = input.receivables;
  if (longOverdue.count > 0) {
    pairs.push([
      `[모의] 장기 미수금 ${longOverdue.amount}(${longOverdue.count}건)입니다.`,
      "[모의] 장기 미수금 거래처에 수금 일정을 확인합니다.",
    ]);
  }

  const improvements = pairs.map(([, fix]) => fix);
  improvements.push(
    unconfirmed
      ? `[모의] ${unconfirmed} 실적을 확정해 분석을 갱신합니다.`
      : "[모의] 실제 분석은 API 키를 넣고 AI_MOCK을 끈 뒤 확인합니다.",
  );

  return {
    summary,
    shortfalls: pairs.map(([issue]) => issue),
    improvements,
  };
}
