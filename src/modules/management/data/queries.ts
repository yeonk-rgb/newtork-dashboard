// 경영지원 지표용 DB 조회 — Prisma 결과를 계산용 순수 데이터로 바꾼다 (서버 전용)
import "server-only";

import { prisma } from "@/shared/db/client";
import { fromMonthIndex, type YearMonth } from "@/shared/period/period";

import type {
  AnnualTargetInput,
  FinanceMonth,
  ArEntryInput,
  ReceivableInput,
} from "../metrics/types";

/** fromIndex ~ toIndex (monthIndex) 범위의 월별 재무 (DRAFT 포함) */
export async function loadFinanceMonths(
  fromIndex: number,
  toIndex: number,
): Promise<FinanceMonth[]> {
  const from: YearMonth = fromMonthIndex(fromIndex);
  const to: YearMonth = fromMonthIndex(toIndex);

  const rows = await prisma.monthlyFinance.findMany({
    where: {
      AND: [
        {
          OR: [
            { year: { gt: from.year } },
            { year: from.year, month: { gte: from.month } },
          ],
        },
        {
          OR: [
            { year: { lt: to.year } },
            { year: to.year, month: { lte: to.month } },
          ],
        },
      ],
    },
    include: { otherExpenses: { include: { category: true } } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  return rows.map((row) => ({
    year: row.year,
    month: row.month,
    status: row.status,
    productSales: row.productSales,
    goodsSales: row.goodsSales,
    serviceSales: row.serviceSales,
    goodsPurchase: row.goodsPurchase,
    materialPurchase: row.materialPurchase,
    operatingExpense: row.operatingExpense,
    otherExpenses: row.otherExpenses.map((e) => ({
      categoryId: e.categoryId,
      name: e.category.name,
      sortOrder: e.category.sortOrder,
      costType: e.category.costType,
      amount: e.amount,
    })),
  }));
}

export async function loadAnnualTarget(
  year: number,
): Promise<AnnualTargetInput | null> {
  const row = await prisma.annualTarget.findUnique({ where: { year } });
  if (!row) return null;
  return {
    year: row.year,
    revenueTarget: row.revenueTarget,
    quarterTargets: [row.q1Target, row.q2Target, row.q3Target, row.q4Target],
    headcount: row.headcount,
  };
}

/**
 * 대시보드·리포트 미수금 = 경영지원 관리 외상매출금 (2026-10-26, 05-22) — 그 해 행, 숨긴 행(deletedAt) 제외
 * 기준월 고르기·합계는 metrics/ar-receivables.ts
 */
export async function loadArEntries(year: number): Promise<ArEntryInput[]> {
  const rows = await prisma.ledgerEntry.findMany({
    where: { kind: "AR", year, deletedAt: null },
    orderBy: [{ month: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    year: r.year,
    month: r.month,
    // 외상매출금은 상태 필수 (schemas.ts) — 비어 있으면 미수(수금예정)로 본다
    status: r.arStatus ?? "SCHEDULED",
    partnerName: r.partnerName,
    amount: r.amount,
    dueOn: r.dueOn,
    settledOn: r.settledOn,
    note: r.note,
  }));
}

/** 미수금 건별 기록 — 숨긴 건(deletedAt) 제외. 2026-10-26부터 건별 참고용 (미수금 건별 기록 화면·건별 엑셀) */
export async function loadReceivables(): Promise<ReceivableInput[]> {
  const rows = await prisma.receivable.findMany({
    where: { deletedAt: null },
    orderBy: { occurredOn: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    occurredOn: r.occurredOn,
    amount: r.amount,
    isCollected: r.isCollected,
    note: r.note,
    collectedOn: r.collectedOn,
    dueOn: r.dueOn,
  }));
}

/** 기간 선택에 보여줄 연도 범위: 데이터·목표가 있는 첫 해 ~ 올해 */
export async function loadYearRange(currentYear: number): Promise<number[]> {
  const [finance, target] = await Promise.all([
    prisma.monthlyFinance.aggregate({ _min: { year: true } }),
    prisma.annualTarget.aggregate({ _min: { year: true } }),
  ]);
  const first = Math.min(
    finance._min.year ?? currentYear,
    target._min.year ?? currentYear,
    currentYear,
  );
  return Array.from({ length: currentYear - first + 1 }, (_, i) => first + i);
}
