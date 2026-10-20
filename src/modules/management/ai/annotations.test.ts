import { describe, expect, it } from "vitest";

import { computeManagementSummary } from "../metrics/summary";
import { date, financeMonth, receivable } from "../metrics/test-fixtures";
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
    receivables: [
      // 기준일 12/31 경과일: a1 120일, a2 150일, b1 95일, c1·d1 121일, e1 40일(90일 이하 → 제외)
      receivable("a1", {
        customerName: "가나발전(가상)",
        occurredOn: date("2024-09-02"),
        amount: 80_000_000n,
      }),
      receivable("a2", {
        customerName: "가나발전(가상)",
        occurredOn: date("2024-08-03"),
        amount: 40_000_000n,
      }),
      receivable("b1", {
        customerName: "다라가스(가상)",
        occurredOn: date("2024-09-27"),
        amount: 66_680_000n,
      }),
      receivable("c1", {
        customerName: "마바오일(가상)",
        occurredOn: date("2024-09-01"),
        amount: 9_000_000n,
      }),
      receivable("d1", {
        customerName: "사아플랜트(가상)",
        occurredOn: date("2024-09-01"),
        amount: 5_000_000n,
      }),
      receivable("e1", {
        customerName: "최근거래처(가상)",
        occurredOn: date("2024-11-21"),
        amount: 500_000_000n,
      }),
    ],
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

  it("90일 초과 거래처: 거래처별로 묶어 금액 큰 순 최대 3곳, 가장 오래된 경과일", () => {
    expect(buildAnnotations(summaryFor(null)).longOverdue).toEqual([
      { name: "가나발전(가상)", amount: "1.20억원", ageDays: 150 },
      { name: "다라가스(가상)", amount: "6,668만원", ageDays: 95 },
      { name: "마바오일(가상)", amount: "900만원", ageDays: 121 },
    ]);
  });
});
