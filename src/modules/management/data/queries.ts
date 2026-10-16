// 경영지원 지표용 DB 조회 — Prisma 결과를 계산용 순수 데이터로 바꾼다 (서버 전용)
import "server-only";

import { prisma } from "@/shared/db/client";
import { fromMonthIndex, type YearMonth } from "@/shared/period/period";

import type {
  AnnualTargetInput,
  FinanceMonth,
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
  };
}

export async function loadReceivables(): Promise<ReceivableInput[]> {
  const rows = await prisma.receivable.findMany({
    orderBy: { occurredOn: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    occurredOn: r.occurredOn,
    amount: r.amount,
    isCollected: r.isCollected,
    collectedOn: r.collectedOn,
    dueOn: r.dueOn,
  }));
}
