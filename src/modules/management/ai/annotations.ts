// AI 카드에 서버가 직접 붙이는 내용 (순수 함수, AI 에 보내지 않음)
// - headline: 연간 목표 달성 한 줄 — 숫자가 틀릴 수 없게 AI 대신 서버가 만든다
// - longOverdue: 90일 초과 미수 거래처명 — 거래처 실명은 외부 AI 로 보내지 않는다 (05-19 확인 전)
// 분석을 생성할 때 함께 저장해, 나중에 데이터가 바뀌어도 그때의 결과와 짝이 맞게 한다
import { formatWonShort } from "@/shared/format/money";

import type { ManagementSummary } from "../metrics/types";

export const LONG_OVERDUE_MAX = 3;

export type LongOverdueCustomer = {
  name: string;
  /** "1.20억원" */
  amount: string;
  /** 가장 오래된 건의 경과일 (분기 말 기준) */
  ageDays: number;
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

  // 90일 초과 건을 거래처별로 묶어 금액 큰 순
  const byCustomer = new Map<string, { amount: bigint; ageDays: number }>();
  for (const item of summary.receivables.items) {
    if (item.bucket !== "90+") continue;
    const prev = byCustomer.get(item.customerName);
    byCustomer.set(item.customerName, {
      amount: (prev?.amount ?? 0n) + item.amount,
      ageDays: Math.max(prev?.ageDays ?? 0, item.ageDays),
    });
  }
  const longOverdue = [...byCustomer.entries()]
    .sort(([an, a], [bn, b]) =>
      a.amount === b.amount
        ? an.localeCompare(bn, "ko")
        : a.amount > b.amount
          ? -1
          : 1,
    )
    .slice(0, LONG_OVERDUE_MAX)
    .map(([name, v]) => ({
      name,
      amount: formatWonShort(v.amount),
      ageDays: v.ageDays,
    }));

  return { headline, longOverdue };
}
