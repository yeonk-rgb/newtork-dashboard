// 목표 대비 실적·미수금 엑셀 테스트용 가짜 지표 입력 (*.test.ts 와 비교 스크립트에서만 — 실제 재무 데이터 아님)
// 2025·2026년 1~9월, 2026년 9월만 임시저장. 연간 목표 28.1억(분기 자동 배분). 미수금은 네 경과일 구간이 모두 있게
import type { Period } from "@/shared/period/period";

import type { SummaryInput } from "../../metrics/summary";
import { date, financeMonth, receivable } from "../../metrics/test-fixtures";
import type { FinanceMonth } from "../../metrics/types";

export const FIXTURE_TODAY = date("2026-10-21");

export function fixtureMonths(): FinanceMonth[] {
  const list: FinanceMonth[] = [];
  for (const year of [2025, 2026]) {
    for (let m = 1; m <= 12; m++) {
      if (year === 2026 && m > 9) break;
      const sales = 180_000_000n + BigInt(m) * 7_000_001n;
      list.push(
        financeMonth(year, m, {
          status: year === 2026 && m === 9 ? "DRAFT" : "CONFIRMED",
          productSales: sales,
          goodsSales: sales / 8n,
          serviceSales: 9_000_000n,
          goodsPurchase: 12_000_000n,
          materialPurchase: 61_000_000n,
          operatingExpense: 31_000_000n,
        }),
      );
    }
  }
  return list;
}

export function fixtureInput(period: Period): SummaryInput {
  return {
    period,
    financeMonths: fixtureMonths(),
    annualTarget: {
      year: 2026,
      revenueTarget: 2_810_000_000n,
      quarterTargets: [null, null, null, null],
    },
    receivables: [
      receivable("a", {
        customerName: "다라발전(가상)",
        occurredOn: date("2026-04-03"),
        dueOn: date("2026-06-30"),
        amount: 88_000_000n,
      }),
      receivable("b", {
        customerName: "다라발전(가상)",
        occurredOn: date("2026-07-22"),
        dueOn: date("2026-10-31"),
        amount: 98_000_000n,
      }),
      receivable("c", {
        customerName: "카타플랜트(가상)",
        occurredOn: date("2026-09-05"),
        amount: 156_000_000n,
      }),
      receivable("d", {
        customerName: "거나수도(가상)",
        occurredOn: date("2026-08-10"),
        dueOn: date("2026-09-15"),
        amount: 21_300_000n,
        note: "분할 입금 예정",
      }),
      // 수금 완료 건은 미수금이 아님
      receivable("e", {
        customerName: "사아오일(가상)",
        occurredOn: date("2026-06-01"),
        amount: 5_000_000n,
        isCollected: true,
        collectedOn: date("2026-07-01"),
      }),
    ],
    today: FIXTURE_TODAY,
  };
}
