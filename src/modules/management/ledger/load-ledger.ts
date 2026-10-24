// 채권·채무 관리 화면 데이터 (서버 전용)
import "server-only";

import { loadUserNames, type NameOf } from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import type { YearMonth } from "@/shared/period/period";

import { toDateOnly, type LedgerRow } from "./rules";

type DbLedgerEntry = Awaited<
  ReturnType<typeof prisma.ledgerEntry.findMany>
>[number];

function toRow(r: DbLedgerEntry, nameOf: NameOf): LedgerRow {
  return {
    id: r.id,
    kind: r.kind,
    arStatus: r.arStatus,
    purchaseType: r.purchaseType,
    expenseType: r.expenseType,
    autoTransfer: r.autoTransfer,
    partnerCode: r.partnerCode,
    partnerName: r.partnerName,
    amount: r.amount.toString(),
    note: r.note,
    dueOn: r.dueOn ? toDateOnly(r.dueOn) : null,
    settledOn: r.settledOn ? toDateOnly(r.settledOn) : null,
    updatedAt: r.updatedAt.toISOString(),
    updatedBy: nameOf(r.updatedById),
    hidden: r.deletedAt !== null,
    deletedAt: r.deletedAt?.toISOString() ?? null,
    deletedBy: r.deletedById ? nameOf(r.deletedById) : null,
  };
}

export type LedgerData = {
  rows: LedgerRow[];
  /** 숨긴 행 (팀장만 받음, 아니면 빈 배열) */
  hiddenRows: LedgerRow[];
};

/** 기준년월의 모든 구분 (입력 순서대로) */
export async function loadLedgerData(
  ym: YearMonth,
  includeHidden: boolean,
): Promise<LedgerData> {
  const rows = await prisma.ledgerEntry.findMany({
    where: {
      year: ym.year,
      month: ym.month,
      ...(includeHidden ? {} : { deletedAt: null }),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const nameOf = await loadUserNames(
    rows.flatMap((r) => [r.updatedById, r.deletedById]),
  );
  const all = rows.map((r) => toRow(r, nameOf));
  return {
    rows: all.filter((r) => !r.hidden),
    hiddenRows: all.filter((r) => r.hidden),
  };
}
