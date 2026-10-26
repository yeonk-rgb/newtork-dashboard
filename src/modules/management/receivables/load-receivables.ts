// 미수금 건별 기록 화면 데이터 (서버 전용)
import "server-only";

import { loadUserNames, type NameOf } from "@/shared/auth";
import { prisma } from "@/shared/db/client";

import { toDateOnly, type ReceivableRow } from "./rules";

type DbReceivable = Awaited<
  ReturnType<typeof prisma.receivable.findMany>
>[number];

function toRow(r: DbReceivable, nameOf: NameOf): ReceivableRow {
  return {
    id: r.id,
    customerName: r.customerName,
    occurredOn: toDateOnly(r.occurredOn),
    amount: r.amount.toString(),
    dueOn: r.dueOn ? toDateOnly(r.dueOn) : null,
    note: r.note,
    isCollected: r.isCollected,
    collectedOn: r.collectedOn ? toDateOnly(r.collectedOn) : null,
    updatedAt: r.updatedAt.toISOString(),
    updatedBy: nameOf(r.updatedById),
    hidden: r.deletedAt !== null,
    deletedAt: r.deletedAt?.toISOString() ?? null,
    deletedBy: r.deletedById ? nameOf(r.deletedById) : null,
  };
}

export type ReceivablesData = {
  rows: ReceivableRow[];
  /** 숨긴 건 (팀장만 받음, 아니면 빈 배열) */
  hiddenRows: ReceivableRow[];
  /** 거래처 자동완성 (숨긴 건 제외, 가나다순) */
  customerNames: string[];
};

export async function loadReceivablesData(
  includeHidden: boolean,
): Promise<ReceivablesData> {
  const [rows, names] = await Promise.all([
    prisma.receivable.findMany({
      where: includeHidden ? {} : { deletedAt: null },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    }),
    prisma.receivable.findMany({
      where: { deletedAt: null },
      distinct: ["customerName"],
      select: { customerName: true },
    }),
  ]);
  const nameOf = await loadUserNames(
    rows.flatMap((r) => [r.updatedById, r.deletedById]),
  );
  const all = rows.map((r) => toRow(r, nameOf));
  return {
    rows: all.filter((r) => !r.hidden),
    hiddenRows: all.filter((r) => r.hidden),
    customerNames: names
      .map((n) => n.customerName)
      .sort((a, b) => a.localeCompare(b, "ko")),
  };
}
