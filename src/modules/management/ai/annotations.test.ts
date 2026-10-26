import { describe, expect, it } from "vitest";

import { computeManagementSummary } from "../metrics/summary";
import { arEntry, date, financeMonth } from "../metrics/test-fixtures";
import { buildAnnotations } from "./annotations";

const q4_2024 = { unit: "quarter", year: 2024, quarter: 4 } as const;

function summaryFor(target: bigint | null) {
  return computeManagementSummary({
    period: q4_2024,
    financeMonths: [
      financeMonth(2024, 1, { productSales: 3_000_000_000n }),
      financeMonth(2024, 10, { productSales: 300_000_000n }),
      financeMonth(2024, 11, { productSales: 200_000_000n }),
      financeMonth(2024, 12, { productSales: 120_000_000n }),
    ],
    annualTarget: target
      ? {
          year: 2024,
          revenueTarget: target,
          quarterTargets: [null, null, null, null],
        }
      : null,
    // 2024년 12월 채권·채무 외상매출금 — 장기미수 4곳 + 당월수금예정 1곳(장기미수 아님 → 제외)
    receivables: [
      ["a1", "가나발전(가상)", 80_000_000n],
      ["a2", "가나발전(가상)", 40_000_000n],
      ["b1", "다라가스(가상)", 66_680_000n],
      ["c1", "마바오일(가상)", 9_000_000n],
      ["d1", "사아플랜트(가상)", 5_000_000n],
    ]
      .map(([id, partnerName, amount]) =>
        arEntry(id as string, {
          year: 2024,
          month: 12,
          status: "LONG_OVERDUE",
          partnerName: partnerName as string,
          amount: amount as bigint,
        }),
      )
      .concat(
        arEntry("e1", {
          year: 2024,
          month: 12,
          partnerName: "최근거래처(가상)",
          amount: 500_000_000n,
        }),
      ),
    today: date("2026-10-20"),
  });
}

describe("buildAnnotations", () => {
  it("headline: 연간 목표 대비 누적 실적 (서버 계산)", () => {
    expect(buildAnnotations(summaryFor(4_000_000_000n)).headline).toBe(
      "연간 목표 40.00억원 중 36.20억원(90.5%)를 달성했습니다.",
    );
  });

  it("headline: 목표가 없으면 분기 확정 매출", () => {
    expect(buildAnnotations(summaryFor(null)).headline).toBe(
      "2024년 4분기 확정 매출은 6.20억원입니다. (연간 목표 미설정)",
    );
  });

  it("장기미수 거래처: 외상매출금 장기미수를 거래처별로 묶어 금액 큰 순 최대 3곳 (경과일 없음)", () => {
    expect(buildAnnotations(summaryFor(null)).longOverdue).toEqual([
      { name: "가나발전(가상)", amount: "1.20억원" },
      { name: "다라가스(가상)", amount: "6,668만원" },
      { name: "마바오일(가상)", amount: "900만원" },
    ]);
  });
});
