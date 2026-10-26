// 자금 수지 예측 입력 조회 (서버 전용) — 계산은 metrics/cash-forecast.ts
import "server-only";

import { prisma } from "@/shared/db/client";
import { monthIndex, type YearMonth } from "@/shared/period/period";

import type { CashForecastInput } from "../metrics/cash-forecast";
import { DEFAULT_METRICS_SETTINGS } from "../metrics/settings";
import { loadFinanceMonths } from "./queries";

/** 이번 달까지 (연·월이 이번 달 이하) */
const upTo = (ym: YearMonth) => ({
  OR: [{ year: { lt: ym.year } }, { year: ym.year, month: { lte: ym.month } }],
});

export async function loadCashForecastInput(
  today: Date,
): Promise<CashForecastInput> {
  const thisMonth = {
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
  };
  const settings = DEFAULT_METRICS_SETTINGS.cashForecast;

  const [latestLedger, financeMonths, cash] = await Promise.all([
    // 경영지원 관리 기준월 = 이번 달까지 행(숨긴 행 제외)이 있는 마지막 달
    prisma.ledgerEntry.findFirst({
      where: { deletedAt: null, ...upTo(thisMonth) },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { year: true, month: true },
    }),
    // 평균은 확정 월 최근 3개 — 1년 안에서 찾는다
    loadFinanceMonths(monthIndex(thisMonth) - 11, monthIndex(thisMonth)),
    prisma.monthlyFinance.findFirst({
      where: { cashBalance: { not: null }, ...upTo(thisMonth) },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { year: true, month: true, cashBalance: true },
    }),
  ]);

  const rows = latestLedger
    ? await prisma.ledgerEntry.findMany({
        where: {
          year: latestLedger.year,
          month: latestLedger.month,
          deletedAt: null,
        },
        select: {
          kind: true,
          arStatus: true,
          amount: true,
          dueOn: true,
          settledOn: true,
        },
      })
    : [];

  return {
    today,
    ledger: latestLedger ? { month: latestLedger, rows } : null,
    financeMonths,
    cashBalance:
      cash?.cashBalance != null
        ? { year: cash.year, month: cash.month, amount: cash.cashBalance }
        : null,
    settings,
  };
}
