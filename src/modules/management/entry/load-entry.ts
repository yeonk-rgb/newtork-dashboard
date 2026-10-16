// 월간 입력 화면 데이터 (서버 전용): 해당 월 값, 전월 값, 그 외 지출 항목
import "server-only";

import { userDisplayName } from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import { addMonths, type YearMonth } from "@/shared/period/period";

import type { EntryStatus } from "./rules";
import { ENTRY_FIELDS, type EntryField } from "./schemas";

export type EntryCategory = {
  id: string;
  name: string;
  /** 비활성 항목이지만 이 달에 값이 있어 보여주는 경우 */
  inactive: boolean;
};

/** 화면에 넘기는 값: 금액은 숫자 문자열(콤마 없음) */
export type EntryData = {
  year: number;
  month: number;
  status: EntryStatus;
  values: Record<EntryField, string>;
  otherExpenses: Record<string, string>;
  previous: {
    values: Record<EntryField, string>;
    otherExpenses: Record<string, string>;
  } | null;
  categories: EntryCategory[];
  /** 동시 수정 확인용 */
  updatedAt: string | null;
  updatedByName: string | null;
  confirmedAt: string | null;
};

async function findMonth(ym: YearMonth) {
  return prisma.monthlyFinance.findUnique({
    where: { year_month: { year: ym.year, month: ym.month } },
    include: { otherExpenses: true },
  });
}

type MonthRow = NonNullable<Awaited<ReturnType<typeof findMonth>>>;

function toValues(row: MonthRow | null): Record<EntryField, string> {
  return Object.fromEntries(
    ENTRY_FIELDS.map((f) => [f, row ? row[f].toString() : ""]),
  ) as Record<EntryField, string>;
}

function toOther(row: MonthRow | null): Record<string, string> {
  return Object.fromEntries(
    (row?.otherExpenses ?? []).map((e) => [e.categoryId, e.amount.toString()]),
  );
}

export async function loadEntry(ym: YearMonth): Promise<EntryData> {
  const [row, prev, categories] = await Promise.all([
    findMonth(ym),
    findMonth(addMonths(ym, -1)),
    prisma.expenseCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const usedHere = new Set((row?.otherExpenses ?? []).map((e) => e.categoryId));
  return {
    year: ym.year,
    month: ym.month,
    status: row ? row.status : "NEW",
    values: toValues(row),
    otherExpenses: toOther(row),
    previous: prev
      ? { values: toValues(prev), otherExpenses: toOther(prev) }
      : null,
    // 활성 항목 + (비활성이지만 이 달에 값이 있는 항목) — 과거 데이터가 사라지지 않게
    categories: categories
      .filter((c) => c.isActive || usedHere.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, inactive: !c.isActive })),
    updatedAt: row ? row.updatedAt.toISOString() : null,
    updatedByName: row ? userDisplayName(row.updatedById) : null,
    confirmedAt: row?.confirmedAt ? row.confirmedAt.toISOString() : null,
  };
}
