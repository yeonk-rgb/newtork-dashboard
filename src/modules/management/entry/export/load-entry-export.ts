// 월간 입력 엑셀 다운로드 — DB 조회 (서버 전용). 임시저장 달도 읽는다 (월 시트에 값 + 빨간 상태 안내)
import "server-only";

import { prisma } from "@/shared/db/client";
import type { YearMonth } from "@/shared/period/period";

import { ENTRY_FIELDS, type EntryField } from "../schemas";
import type { EntryCategoryInfo, EntryMonthData } from "./plan";

/** 같은 해의 달 목록 (다운로드 기간은 한 해 안) */
export async function loadEntryExportData(months: YearMonth[]): Promise<{
  data: EntryMonthData[];
  categories: EntryCategoryInfo[];
}> {
  if (months.length === 0) return { data: [], categories: [] };
  const [rows, categories] = await Promise.all([
    prisma.monthlyFinance.findMany({
      where: {
        year: months[0].year,
        month: { in: months.map((m) => m.month) },
      },
      include: { otherExpenses: true },
      orderBy: { month: "asc" },
    }),
    prisma.expenseCategory.findMany({
      select: { id: true, name: true, isActive: true, sortOrder: true },
    }),
  ]);
  return {
    data: rows.map((row) => ({
      year: row.year,
      month: row.month,
      status: row.status,
      confirmedAt: row.confirmedAt,
      values: Object.fromEntries(
        ENTRY_FIELDS.map((f) => [f, row[f]]),
      ) as Record<EntryField, bigint>,
      others: new Map(row.otherExpenses.map((e) => [e.categoryId, e.amount])),
    })),
    categories,
  };
}
