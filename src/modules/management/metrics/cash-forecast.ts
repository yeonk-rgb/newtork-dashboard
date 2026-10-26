// 3~6개월 자금 수지 예측 (순수 함수 — DB·화면 모름, 2026-10-26 자료 기반 결정 05-41~46)
// - 예측 기간: 이번 달 다음 달부터 최대 6개월 (화면 기본 3개월)
// - 금액은 실제 주고받는 금액(부가세 포함). 경영지원 관리는 그대로, 월간 입력 평균은 매출·매입·그 외 지출에 ×1.1
// - 예정(경영지원 관리 기준월 B 행)
//   · 들어올 돈 = 외상매출금 당월 수금예정 — 예정일 달. 예정일이 없거나 지났으면 첫 달로. 장기 미수금은 넣지 않음 (05-45)
//   · 나갈 돈 = 외상매입금·미지급비용(직원·업체, 자동이체 포함) — 예정일 달, 비었으면 B 다음 달 (05-43). 완료일 있는 행은 이미 나간 돈
// - 추정(B+2 달부터, 경영지원 관리가 없으면 모든 달): 최근 확정 3개월 평균 (정기 지출 표 없음 05-44)
//   B 다음 달 지출은 경영지원 관리 총액과 같은 숫자라 평균을 더하지 않는다 (05-24 이중 계산 방지)
// - 예상 잔액: 월간 입력 "월말 통장 잔액"이 있으면 가장 최근 값 + 누적 순수지 (05-41), 없으면 null
import {
  addMonths,
  monthIndex,
  type YearMonth,
} from "@/shared/period/period";

import type { FinanceMonth } from "./types";

export type CashLedgerRow = {
  kind: "AR" | "AP" | "ACCRUED_STAFF" | "ACCRUED_VENDOR";
  arStatus: "LONG_OVERDUE" | "COLLECTED" | "SCHEDULED" | null;
  amount: bigint;
  dueOn: Date | null;
  settledOn: Date | null;
};

export type CashForecastSettings = {
  /** 추정에 쓰는 최근 확정 개월 수 */
  averageMonths: number;
  /** 계산하는 최대 개월 수 (화면은 3·6 전환) */
  maxMonths: number;
};

export type CashForecastInput = {
  /** 한국 날짜 (UTC 자정) */
  today: Date;
  /** 경영지원 관리 기준월 B (이번 달까지 행이 있는 마지막 달) 와 그 달 행 (숨긴 행 제외). 없으면 null */
  ledger: { month: YearMonth; rows: CashLedgerRow[] } | null;
  /** 월별 실적 (확정 아닌 달은 무시) */
  financeMonths: FinanceMonth[];
  /** 가장 최근에 입력한 월말 통장 잔액 (이번 달까지) */
  cashBalance: (YearMonth & { amount: bigint }) | null;
  settings: CashForecastSettings;
};

export type AmountCount = { amount: bigint; count: number };

export type CashForecastMonth = YearMonth & {
  inflowPlanned: bigint;
  /** null = 추정하지 않는 달 */
  inflowEstimated: bigint | null;
  outflowPlanned: bigint;
  outflowEstimated: bigint | null;
  /** 수입 − 지출 (예정 + 추정) */
  net: bigint;
  /** 첫 달부터 누적 순수지 */
  cumulative: bigint;
  /** 예상 월말 잔액 (통장 잔액 입력이 없으면 null) */
  balance: bigint | null;
};

export type CashForecast = {
  /** 기준일 */
  asOf: Date;
  months: CashForecastMonth[];
  ledgerMonth: YearMonth | null;
  /** 추정에 쓴 확정 월과 월평균 (부가세 포함 환산 후). 확정 월이 없으면 null */
  average: {
    months: YearMonth[];
    inflow: bigint;
    outflow: bigint;
  } | null;
  opening: (YearMonth & { amount: bigint; gapMonths: number }) | null;
  /** 안내용 숫자 */
  notes: {
    /** 예정일이 없거나 지나서 첫 달로 넣은 수금예정 */
    carriedInflow: AmountCount;
    /** 넣지 않은 장기 미수금 */
    longOverdue: AmountCount;
    /** 지급 예정 달이 이미 지나 이미 나간 돈으로 본 행 */
    pastOutflow: AmountCount;
    /** 예측 기간 뒤로 예정된 돈 (들어올 / 나갈) */
    beyondInflow: AmountCount;
    beyondOutflow: AmountCount;
  };
};

/** 부가세 포함 환산 ×1.1 (원 단위 반올림) */
export function withVat(amount: bigint): bigint {
  return (amount * 11n + 5n) / 10n;
}

const ymOf = (d: Date): YearMonth => ({
  year: d.getUTCFullYear(),
  month: d.getUTCMonth() + 1,
});
const zero = (): AmountCount => ({ amount: 0n, count: 0 });
const add = (s: AmountCount, amount: bigint) => {
  s.amount += amount;
  s.count += 1;
};
const sum = (xs: bigint[]) => xs.reduce((s, x) => s + x, 0n);

/** 평균 (원 단위 반올림) */
function average(values: bigint[]): bigint {
  const n = BigInt(values.length);
  return (sum(values) * 2n + n) / (2n * n);
}

export function computeCashForecast(input: CashForecastInput): CashForecast {
  const { today, ledger, settings } = input;
  const thisMonth = ymOf(today);
  const start = addMonths(thisMonth, 1);
  const startIndex = monthIndex(start);
  const window = Array.from({ length: settings.maxMonths }, (_, i) =>
    addMonths(start, i),
  );
  const slot = (ym: YearMonth) => monthIndex(ym) - startIndex;

  const inflowPlanned = window.map(() => 0n);
  const outflowPlanned = window.map(() => 0n);
  const notes: CashForecast["notes"] = {
    carriedInflow: zero(),
    longOverdue: zero(),
    pastOutflow: zero(),
    beyondInflow: zero(),
    beyondOutflow: zero(),
  };

  if (ledger) {
    const defaultPay = addMonths(ledger.month, 1);
    for (const r of ledger.rows) {
      if (r.kind === "AR") {
        if (r.arStatus === "LONG_OVERDUE") add(notes.longOverdue, r.amount);
        if (r.arStatus !== "SCHEDULED") continue; // 당월 수금 = 이미 들어온 돈
        const i = r.dueOn ? Math.max(0, slot(ymOf(r.dueOn))) : 0;
        if (!r.dueOn || slot(ymOf(r.dueOn)) < 0)
          add(notes.carriedInflow, r.amount);
        if (i >= window.length) add(notes.beyondInflow, r.amount);
        else inflowPlanned[i] += r.amount;
        continue;
      }
      if (r.settledOn) continue; // 이미 나간 돈
      if (r.dueOn) {
        // 예정일이 지났는데 완료일이 없으면 아직 안 나간 돈 → 첫 달
        const i = Math.max(0, slot(ymOf(r.dueOn)));
        if (i >= window.length) add(notes.beyondOutflow, r.amount);
        else outflowPlanned[i] += r.amount;
        continue;
      }
      const i = slot(defaultPay);
      if (i < 0) add(notes.pastOutflow, r.amount);
      else if (i >= window.length) add(notes.beyondOutflow, r.amount);
      else outflowPlanned[i] += r.amount;
    }
  }

  // 추정: 최근 확정 N개월 평균 (이번 달까지)
  const confirmed = input.financeMonths
    .filter(
      (m) =>
        m.status === "CONFIRMED" && monthIndex(m) <= monthIndex(thisMonth),
    )
    .sort((a, b) => monthIndex(b) - monthIndex(a))
    .slice(0, settings.averageMonths);
  const avg =
    confirmed.length === 0
      ? null
      : {
          months: confirmed
            .map(({ year, month }) => ({ year, month }))
            .reverse(),
          inflow: average(
            confirmed.map((m) =>
              withVat(m.productSales + m.goodsSales + m.serviceSales),
            ),
          ),
          outflow: average(
            confirmed.map(
              (m) =>
                withVat(
                  m.goodsPurchase +
                    m.materialPurchase +
                    sum(m.otherExpenses.map((e) => e.amount)),
                ) + m.operatingExpense,
            ),
          ),
        };
  // 경영지원 관리가 있으면 B+2 달부터 추정 (B+1 은 경영지원 관리 총액으로 예정이 잡혀 있음)
  const estimateFrom = ledger
    ? monthIndex(addMonths(ledger.month, 2))
    : Number.NEGATIVE_INFINITY;

  let cumulative = 0n;
  const opening = input.cashBalance
    ? {
        ...input.cashBalance,
        gapMonths: monthIndex(thisMonth) - monthIndex(input.cashBalance),
      }
    : null;

  const months = window.map((ym, i): CashForecastMonth => {
    const estimate = monthIndex(ym) >= estimateFrom && avg !== null;
    const inflowEstimated = estimate ? avg.inflow : null;
    const outflowEstimated = estimate ? avg.outflow : null;
    const net =
      inflowPlanned[i] +
      (inflowEstimated ?? 0n) -
      outflowPlanned[i] -
      (outflowEstimated ?? 0n);
    cumulative += net;
    return {
      ...ym,
      inflowPlanned: inflowPlanned[i],
      inflowEstimated,
      outflowPlanned: outflowPlanned[i],
      outflowEstimated,
      net,
      cumulative,
      balance: opening ? opening.amount + cumulative : null,
    };
  });

  return {
    asOf: today,
    months,
    ledgerMonth: ledger?.month ?? null,
    average: avg,
    opening,
    notes,
  };
}
