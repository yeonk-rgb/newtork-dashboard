// 목표 대비 실적·미수금 엑셀 테스트용 가짜 지표 입력 (*.test.ts 와 비교 스크립트에서만 — 실제 재무 데이터 아님)
// 2025·2026년 1~9월, 2026년 9월만 임시저장. 연간 목표 28.1억(분기 자동 배분).
// 미수금(대시보드) = 경영지원 관리 외상매출금 8·9월 (2026-10-26) — 건별 목록(fixtureItemReceivables)을 월말 잔액으로 옮긴 것과 같은 금액
// 건별 목록은 미수금 건별 기록 엑셀 테스트용으로 네 경과일 구간이 모두 있게
import type { Period } from "@/shared/period/period";

import type { SummaryInput } from "../../metrics/summary";
import { computeItemReceivables } from "../../metrics/receivables";
import { date, financeMonth, receivable } from "../../metrics/test-fixtures";
import type {
  ArEntryInput,
  FinanceMonth,
  ReceivableInput,
} from "../../metrics/types";

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
    receivables: fixtureArEntries(),
    today: FIXTURE_TODAY,
  };
}

/** 미수금 건별 기록 — 9/30 기준 네 경과일 구간 (건별 엑셀 테스트) */
export function fixtureItemReceivables(): ReceivableInput[] {
  return [
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
  ];
}

const ar = (
  id: string,
  month: number,
  status: ArEntryInput["status"],
  partnerName: string,
  amount: bigint,
  opts: Partial<ArEntryInput> = {},
): ArEntryInput => ({
  id,
  year: 2026,
  month,
  status,
  partnerName,
  amount,
  dueOn: null,
  settledOn: null,
  note: null,
  ...opts,
});

/**
 * 경영지원 관리 외상매출금 8·9월 — 건별 목록의 월말 잔액 (90일 넘은 건 = 장기 미수금, 그 달 수금 = 당월 수금)
 * 9월 미수 = 8,800만(장기 미수금) + 9,800만 + 1억5,600만 + 2,130만 = 3억6,330만
 */
export function fixtureArEntries(): ArEntryInput[] {
  return [
    ar("ar-08-a", 8, "LONG_OVERDUE", "다라발전(가상)", 88_000_000n, {
      dueOn: date("2026-06-30"),
    }),
    ar("ar-08-b", 8, "SCHEDULED", "다라발전(가상)", 98_000_000n, {
      dueOn: date("2026-10-31"),
    }),
    ar("ar-08-d", 8, "SCHEDULED", "거나수도(가상)", 21_300_000n, {
      dueOn: date("2026-09-15"),
      note: "분할 입금 예정",
    }),
    ar("ar-09-a", 9, "LONG_OVERDUE", "다라발전(가상)", 88_000_000n, {
      dueOn: date("2026-06-30"),
    }),
    ar("ar-09-b", 9, "SCHEDULED", "다라발전(가상)", 98_000_000n, {
      dueOn: date("2026-10-31"),
    }),
    ar("ar-09-c", 9, "SCHEDULED", "카타플랜트(가상)", 156_000_000n),
    ar("ar-09-d", 9, "SCHEDULED", "거나수도(가상)", 21_300_000n, {
      dueOn: date("2026-09-15"),
      note: "분할 입금 예정",
    }),
    ar("ar-09-e", 9, "COLLECTED", "사아오일(가상)", 5_000_000n, {
      settledOn: date("2026-09-20"),
    }),
  ];
}

/** 미수금 건별 기록 엑셀 입력 — 3분기 말(9/30) 기준 건별 잔액 */
export const fixtureItemResult = () =>
  computeItemReceivables(fixtureItemReceivables(), date("2026-09-30"), 6);
