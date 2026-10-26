// 인당 생산성 (순수 함수, 2026-10-26 기획서 "인당 생산성 지표") — 확정된 달 합계 ÷ 직원 수
//   매출 ÷ 인원, 추정 이익 ÷ 인원 (원 단위 반올림). 직원 수는 목표·항목 설정의 연도별 값
import type { PeriodCore, ProductivityResult } from "./types";

/** a ÷ b 를 원 단위 반올림 (음수는 0에서 먼 쪽으로 반 올림 — 이익이 적자여도 대칭) */
function roundDiv(a: bigint, b: bigint): bigint {
  const neg = a < 0n;
  const abs = neg ? -a : a;
  const q = (abs * 2n + b) / (b * 2n);
  return neg ? -q : q;
}

export function computeProductivity(
  core: Pick<PeriodCore, "confirmation" | "revenue" | "profit">,
  headcount: number | null | undefined,
): ProductivityResult {
  const people = headcount ?? null;
  if (people === null || people <= 0) {
    return {
      headcount: null,
      revenuePerHead: null,
      profitPerHead: null,
      reason: "no-headcount",
    };
  }
  if (!core.confirmation.hasData) {
    return {
      headcount: people,
      revenuePerHead: null,
      profitPerHead: null,
      reason: "no-data",
    };
  }
  const n = BigInt(people);
  return {
    headcount: people,
    revenuePerHead: roundDiv(core.revenue.total, n),
    profitPerHead: roundDiv(core.profit.profit, n),
    reason: null,
  };
}
