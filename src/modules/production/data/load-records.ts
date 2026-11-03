// 생산팀 조회 (서버 전용) — 기간 안에 출고됐거나 납기가 있는 제조내역, 사업구분, 목표
import "server-only";

import { prisma } from "@/shared/db/client";
import { periodDateRange, type Period } from "@/shared/period/period";

import type { ProductionTargets, RecordRow } from "../metrics/sales-share";
import { PRODUCTION_SAMPLE_BY } from "./sample";

export async function loadRecords(period: Period): Promise<RecordRow[]> {
  const range = periodDateRange(period);
  const rows = await prisma.prodRecord.findMany({
    where: {
      deletedAt: null,
      OR: [{ shippedDate: range }, { dueDate: range }],
    },
    select: {
      sheetName: true,
      serialNo: true,
      orderNo: true,
      modelCode: true,
      seller: true,
      shippedDate: true,
      dueDate: true,
      quantity: true,
      createdById: true,
    },
  });
  return rows.map(({ createdById, ...r }) => ({
    ...r,
    sample: createdById === PRODUCTION_SAMPLE_BY,
  }));
}

/** 수주번호 → 사업구분 코드 (지정한 것만) */
export async function loadCategories(
  orderNos: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(orderNos.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await prisma.prodOrderCategory.findMany({
    where: { orderNo: { in: unique } },
    select: { orderNo: true, category: true },
  });
  return new Map(rows.map((r) => [r.orderNo, r.category]));
}

export async function loadTargets(year: number): Promise<ProductionTargets> {
  const [annual, monthly] = await Promise.all([
    prisma.prodAnnualTarget.findUnique({ where: { year } }),
    prisma.prodMonthlyTarget.findMany({ where: { year } }),
  ]);
  return {
    annual: annual?.annualTarget ?? null,
    monthly: new Map(monthly.map((m) => [m.month, m.target])),
  };
}
