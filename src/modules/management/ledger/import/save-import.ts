// 채권·채무 엑셀 이관 저장 (서버 전용) — 한 트랜잭션: (덮어쓰기면) 기존 행 숨김 → 이력 → 행 저장
import "server-only";

import { prisma } from "@/shared/db/client";

import { LEDGER_KINDS, type LedgerKind } from "../labels";
import { parseDateOnly } from "../rules";
import { toLedgerData } from "../schemas";
import type { ImportMode, ImportPlan } from "./plan";

/** 같은 기준년월의 숨기지 않은 행 수 (구분별) */
export async function countExisting(
  year: number,
  month: number,
): Promise<Record<LedgerKind, number>> {
  const grouped = await prisma.ledgerEntry.groupBy({
    by: ["kind"],
    where: { year, month, deletedAt: null },
    _count: { _all: true },
  });
  return Object.fromEntries(
    LEDGER_KINDS.map((k) => [
      k,
      grouped.find((g) => g.kind === k)?._count._all ?? 0,
    ]),
  ) as Record<LedgerKind, number>;
}

export class ExistingChangedError extends Error {
  constructor() {
    super("미리보기 후 같은 기준년월 데이터가 바뀌었습니다.");
    this.name = "ExistingChangedError";
  }
}

export type SaveImportInput = {
  userId: string;
  now: Date;
  year: number;
  month: number;
  mode: ImportMode;
  /** 미리보기 때 본 기존 행 수 — 다르면 저장하지 않는다 */
  expectedExisting: number;
  fileName: string;
  fileSha256: string;
  sheetName: string;
  plan: ImportPlan;
  /** 건너뛴 행 수 (코드만·0원) */
  excludedRows: number;
};

export async function saveLedgerImport(input: SaveImportInput) {
  const { userId, now, year, month, plan } = input;
  const date = (v: string | null) => (v ? parseDateOnly(v) : null);

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.ledgerEntry.count({
        where: { year, month, deletedAt: null },
      });
      if (existing !== input.expectedExisting) throw new ExistingChangedError();

      const hidden =
        input.mode === "overwrite"
          ? (
              await tx.ledgerEntry.updateMany({
                where: { year, month, deletedAt: null },
                data: {
                  deletedAt: now,
                  deletedById: userId,
                  updatedById: userId,
                },
              })
            ).count
          : 0;

      const blocks = LEDGER_KINDS.map((kind) => ({
        kind,
        count: plan.summary[kind].count,
        sum: plan.summary[kind].sum.toString(),
      }));
      const upload = await tx.dataUpload.create({
        data: {
          fileNames: [input.fileName],
          sheets: [
            {
              fileName: input.fileName,
              sheetName: input.sheetName,
              kind: "ledger",
              savedRows: plan.entries.length,
              excludedRows: input.excludedRows,
            },
          ],
          savedRows: plan.entries.length,
          detail: {
            kind: "ledger",
            year,
            month,
            mode: input.mode,
            hiddenRows: hidden,
            blocks,
            fileSha256: input.fileSha256,
          },
          createdById: userId,
          createdAt: now,
        },
      });

      await tx.ledgerEntry.createMany({
        // 화면 목록은 createdAt 순 — 엑셀 행 순서가 유지되도록 1ms씩 늘린다
        data: plan.entries.map(({ fields }, i) => {
          const data = toLedgerData(fields);
          return {
            year,
            month,
            ...data,
            dueOn: date(data.dueOn),
            settledOn: date(data.settledOn),
            uploadId: upload.id,
            createdById: userId,
            updatedById: userId,
            createdAt: new Date(now.getTime() + i),
          };
        }),
      });

      return { uploadId: upload.id, hidden, blocks };
    },
    { isolationLevel: "Serializable" },
  );
}
