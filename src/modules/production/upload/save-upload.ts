// 제조내역 업로드 조회·저장 (서버 전용). 친구 저장소 backend/production/services.py save_upload 규칙 그대로:
// - 같은 파일(SHA-256) 재업로드 차단
// - 새 일련번호는 저장, 값이 바뀐 행은 사용자가 체크한 것만 덮어씀 — 엑셀에 있는 칸만(수량 등 사람이 입력한 값은 유지)
// - 저장할 내용이 없으면 오류
// + 이 저장소 규칙: 한 트랜잭션 안에서 변경 이력 요약 1건 (기록 실패 시 저장도 취소), 숨긴 행은 건드리지 않음
import "server-only";

import { createHash } from "node:crypto";

import { recordAudit } from "@/shared/audit/record";
import type { AppUser } from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import type { Prisma } from "@/shared/db/generated/client";

import {
  allWarnings,
  classifiedErrors,
  classify,
  recordKey,
  skippedCount,
  type ExistingRecord,
} from "./classify";
import { COLUMNS, DATE_FIELDS, type RecordField } from "./columns";
import type { ParsedSheet, RecordValues } from "./parse-sheet";

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export const fileHash = (data: ArrayBuffer) =>
  createHash("sha256").update(Buffer.from(data)).digest("hex");

const RECORD_SELECT = Object.fromEntries(
  COLUMNS.map((c) => [c.field, true]),
) as Record<RecordField, true>;

/** DB 값 → 엑셀 비교용 값 (날짜는 "YYYY-MM-DD") */
export function toValues(record: Record<string, unknown>): RecordValues {
  const values: RecordValues = {};
  for (const c of COLUMNS) {
    const v = record[c.field];
    values[c.field] = DATE_FIELDS.has(c.field)
      ? v instanceof Date
        ? v.toISOString().slice(0, 10)
        : null
      : typeof v === "string"
        ? v
        : "";
  }
  return values;
}

/** 엑셀 값 → Prisma 저장 값 (읽은 칸만) */
function toData(values: RecordValues, fields: RecordField[]) {
  const data: Record<string, string | Date | null> = {};
  for (const f of fields) {
    const v = values[f] ?? null;
    data[f] = DATE_FIELDS.has(f)
      ? v
        ? new Date(`${v}T00:00:00Z`)
        : null
      : (v ?? "");
  }
  return data;
}

export async function loadExisting(
  sheets: ParsedSheet[],
  tx: Pick<Prisma.TransactionClient, "prodRecord"> = prisma,
): Promise<Map<string, ExistingRecord>> {
  const names = sheets.filter((s) => !s.error).map((s) => s.name);
  if (names.length === 0) return new Map();
  const rows = await tx.prodRecord.findMany({
    where: { sheetName: { in: names } },
    select: { ...RECORD_SELECT, id: true, sheetName: true, deletedAt: true },
  });
  return new Map(
    rows.map((r) => [
      recordKey(r.sheetName, r.serialNo),
      { id: r.id, values: toValues(r), hidden: r.deletedAt !== null },
    ]),
  );
}

export async function findUploadedBatch(hash: string) {
  return prisma.prodUploadBatch.findUnique({
    where: { fileHash: hash },
    select: { uploadedAt: true, uploadedById: true },
  });
}

export async function saveUpload(input: {
  fileName: string;
  hash: string;
  sheets: ParsedSheet[];
  overwriteKeys: string[];
  user: AppUser;
  now: Date;
}) {
  const { fileName, hash, sheets, user, now } = input;
  const overwrite = new Set(input.overwriteKeys);
  return prisma.$transaction(
    async (tx) => {
      if (await tx.prodUploadBatch.findUnique({ where: { fileHash: hash } })) {
        throw new UploadError(
          "이미 업로드한 파일입니다. 내용을 고친 파일이라면 수정본을 저장한 뒤 다시 올려 주세요.",
        );
      }
      // 미리보기 뒤 다른 사람이 저장했을 수 있으므로 트랜잭션 안에서 다시 판정
      const c = classify(sheets, await loadExisting(sheets, tx));
      const toOverwrite = c.changed.filter((r) =>
        overwrite.has(recordKey(r.sheet, r.row.values.serialNo)),
      );
      if (c.created.length === 0 && toOverwrite.length === 0) {
        throw new UploadError(
          "저장할 내용이 없습니다. 새 일련번호가 없고, 덮어쓰기로 선택한 행도 없습니다.",
        );
      }
      const fieldsOf = new Map(sheets.map((s) => [s.name, s.fields]));
      const warnings = allWarnings(c);
      const batch = await tx.prodUploadBatch.create({
        data: {
          fileName: fileName.slice(0, 255),
          fileHash: hash,
          sheetNames: sheets.filter((s) => !s.error).map((s) => s.name),
          createdCount: c.created.length,
          overwrittenCount: toOverwrite.length,
          unchangedCount: c.unchanged.length,
          keptCount: c.changed.length - toOverwrite.length,
          skippedCount: skippedCount(c),
          errorCount: classifiedErrors(c).length,
          warnings: warnings as unknown as Prisma.InputJsonValue,
          uploadedById: user.id,
          uploadedAt: now,
        },
      });
      await tx.prodRecord.createMany({
        data: c.created.map(({ sheet, row }) => ({
          ...toData(row.values, fieldsOf.get(sheet)!),
          sheetName: sheet,
          serialNo: row.values.serialNo,
          sourceRow: row.row,
          importWarnings: row.warnings as unknown as Prisma.InputJsonValue,
          batchId: batch.id,
          createdById: user.id,
          updatedById: user.id,
          createdAt: now,
          updatedAt: now,
        })),
      });
      for (const { sheet, row, id } of toOverwrite) {
        await tx.prodRecord.update({
          where: { id },
          data: {
            ...toData(row.values, fieldsOf.get(sheet)!),
            sourceRow: row.row,
            importWarnings: row.warnings as unknown as Prisma.InputJsonValue,
            batchId: batch.id,
            updatedById: user.id,
          },
        });
      }
      await recordAudit(tx, {
        occurredAt: now,
        actor: { id: user.id, loginId: user.loginId },
        area: "production",
        screen: "production-upload",
        action: "IMPORT",
        target: { type: "ProdUploadBatch", id: batch.id, label: fileName },
        meta: {
          uploadId: batch.id,
          fileName,
          created: c.created.length,
          overwritten: toOverwrite.length,
          kept: c.changed.length - toOverwrite.length,
          unchanged: c.unchanged.length,
          hidden: c.hidden.length,
          skipped: skippedCount(c),
        },
      });
      return {
        created: c.created.length,
        overwritten: toOverwrite.length,
      };
    },
    { isolationLevel: "Serializable" },
  );
}

export async function loadRecentBatches() {
  return prisma.prodUploadBatch.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 20,
    select: {
      id: true,
      fileName: true,
      uploadedAt: true,
      uploadedById: true,
      createdCount: true,
      overwrittenCount: true,
      unchangedCount: true,
      keptCount: true,
      skippedCount: true,
      errorCount: true,
    },
  });
}
