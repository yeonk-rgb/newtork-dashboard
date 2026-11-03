// 생산 대시보드 조회 (서버 전용) — 그 해 출고·납기 제조내역, 사업구분, 목표, 출고일 없음(전체 기간), 자료가 있는 연도
import "server-only";

import { prisma } from "@/shared/db/client";

import { loadCategories, loadTargets } from "../data/load-records";
import { PRODUCTION_SAMPLE_BY } from "../data/sample";
import type { RecordRow } from "../metrics/sales-share";

export async function loadYearRecords(year: number): Promise<RecordRow[]> {
  const range = {
    gte: new Date(Date.UTC(year, 0, 1)),
    lt: new Date(Date.UTC(year + 1, 0, 1)),
  };
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

/** 출고일 또는 납기일이 있는 연도 + 목표가 있는 연도 + 올해 (최신순) */
export async function loadYearsAvailable(thisYear: number): Promise<number[]> {
  const [dates, annual, monthly] = await Promise.all([
    prisma.$queryRaw<{ y: number }[]>`
      SELECT DISTINCT y::int AS y FROM (
        SELECT EXTRACT(YEAR FROM "shippedDate") AS y FROM prod_record WHERE "deletedAt" IS NULL AND "shippedDate" IS NOT NULL
        UNION SELECT EXTRACT(YEAR FROM "dueDate") FROM prod_record WHERE "deletedAt" IS NULL AND "dueDate" IS NOT NULL
      ) t`,
    prisma.prodAnnualTarget.findMany({ select: { year: true } }),
    prisma.prodMonthlyTarget.findMany({
      distinct: ["year"],
      select: { year: true },
    }),
  ]);
  const years = new Set([
    thisYear,
    ...dates.map((d) => d.y),
    ...annual.map((a) => a.year),
    ...monthly.map((m) => m.year),
  ]);
  return [...years].sort((a, b) => b - a);
}

export async function loadDashboardData(year: number, thisYear: number) {
  const [rows, targets, noShippedDate, years] = await Promise.all([
    loadYearRecords(year),
    loadTargets(year),
    prisma.prodRecord.count({ where: { deletedAt: null, shippedDate: null } }),
    loadYearsAvailable(thisYear),
  ]);
  const categories = await loadCategories(rows.map((r) => r.orderNo));
  return { rows, targets, categories, noShippedDate, years };
}
