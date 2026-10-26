// 목표·항목 설정 화면 데이터 (서버 전용)
import "server-only";

import { prisma } from "@/shared/db/client";

export type TargetData = {
  year: number;
  /** 콤마 없는 숫자 문자열, 미설정이면 "" */
  revenueTarget: string;
  quarters: [string, string, string, string];
  /** 직원 수, 미입력이면 "" */
  headcount: string;
  updatedAt: string | null;
};

export async function loadTarget(year: number): Promise<TargetData> {
  const row = await prisma.annualTarget.findUnique({ where: { year } });
  const s = (v: bigint | null | undefined) => (v == null ? "" : v.toString());
  return {
    year,
    revenueTarget: s(row?.revenueTarget),
    quarters: [
      s(row?.q1Target),
      s(row?.q2Target),
      s(row?.q3Target),
      s(row?.q4Target),
    ],
    headcount: row?.headcount == null ? "" : String(row.headcount),
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}

export type CategoryRow = {
  id: string;
  name: string;
  costType: "FIXED" | "VARIABLE" | null;
  isActive: boolean;
  /** 0원이 아닌 금액이 있는 달 수 — 0이면 삭제 가능 */
  usedMonths: number;
};

export async function loadCategories(): Promise<{
  rows: CategoryRow[];
  version: string;
}> {
  const [categories, usage] = await Promise.all([
    prisma.expenseCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.otherExpense.groupBy({
      by: ["categoryId"],
      where: { amount: { not: 0n } },
      _count: { _all: true },
    }),
  ]);
  const used = new Map(usage.map((u) => [u.categoryId, u._count._all]));
  return {
    rows: categories.map((c) => ({
      id: c.id,
      name: c.name,
      costType: c.costType,
      isActive: c.isActive,
      usedMonths: used.get(c.id) ?? 0,
    })),
    version: categoriesVersion(categories),
  };
}

/** 동시 수정 확인용: 항목 수 + 가장 최근 수정 시각 */
export function categoriesVersion(categories: { updatedAt: Date }[]): string {
  const latest = categories.reduce(
    (max, c) => Math.max(max, c.updatedAt.getTime()),
    0,
  );
  return `${categories.length}:${latest}`;
}
