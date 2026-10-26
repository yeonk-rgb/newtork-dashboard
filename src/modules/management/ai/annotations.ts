// AI 카드에 서버가 직접 붙이는 내용 (순수 함수, AI 에 보내지 않음)
// - headline: 연간 목표 달성 한 줄 — 숫자가 틀릴 수 없게 AI 대신 서버가 만든다
// - longOverdue: 장기 미수금 거래처명 (경영지원 관리 외상매출금 "장기 미수금", 2026-10-26) — 거래처 실명은 외부 AI 로 보내지 않는다 (05-19)
// 분석을 생성할 때 함께 저장해, 나중에 데이터가 바뀌어도 그때의 결과와 짝이 맞게 한다
import { formatWonShort } from "@/shared/format/money";

import type { ManagementSummary } from "../metrics/types";

export const LONG_OVERDUE_MAX = 3;

export type LongOverdueCustomer = {
  name: string;
  /** "1.20억원" */
  amount: string;
  /** 옛 기록(90일 초과 건별)만 — 가장 오래된 건의 경과일. 외상매출금 기준 기록에는 없음 */
  ageDays?: number;
};

export type AiCommentAnnotations = {
  headline: string;
  longOverdue: LongOverdueCustomer[];
};

export function buildAnnotations(
  summary: ManagementSummary,
): AiCommentAnnotations {
  const annual = summary.targets.annual;
  const headline =
    annual && annual.rate !== null
      ? `연간 목표 ${formatWonShort(annual.target)} 중 ${formatWonShort(annual.actual)}(${(annual.rate * 100).toFixed(1)}%)를 달성했습니다.`
      : `${summary.label} 확정 매출은 ${formatWonShort(summary.revenue.total)}입니다. (연간 목표 미설정)`;

  // 장기 미수금이 있는 거래처, 장기 미수금 금액 큰 순 (같으면 이름순)
  const longOverdue = summary.receivables.byCustomer
    .filter((c) => c.longOverdue > 0n)
    .sort((a, b) =>
      a.longOverdue === b.longOverdue
        ? a.customerName.localeCompare(b.customerName, "ko")
        : a.longOverdue > b.longOverdue
          ? -1
          : 1,
    )
    .slice(0, LONG_OVERDUE_MAX)
    .map((c) => ({
      name: c.customerName,
      amount: formatWonShort(c.longOverdue),
    }));

  return { headline, longOverdue };
}
