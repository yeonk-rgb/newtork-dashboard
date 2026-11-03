// 조회한 제조내역 → 화면 행 (제조내역 표·일련번호 검색 상세 공용, 서버 전용)
import "server-only";

import { kstDateTime } from "@/shared/format/date-time";

import { COLUMNS, DATE_FIELDS } from "../upload/columns";
import type { ParseWarning } from "../upload/parse-sheet";
import type { RecordRowData } from "./load-records";
import type { RecordRow } from "./record-table";

export function toRow(
  r: RecordRowData,
  nameOf: (id: string) => string,
): RecordRow {
  const values = Object.fromEntries(
    COLUMNS.map((c) => {
      const v = (r as Record<string, unknown>)[c.field];
      return [
        c.field,
        DATE_FIELDS.has(c.field)
          ? v instanceof Date
            ? v.toISOString().slice(0, 10)
            : ""
          : String(v ?? ""),
      ];
    }),
  );
  return {
    ...(values as unknown as Omit<RecordRow, "id">),
    id: r.id,
    sheetName: r.sheetName,
    serialNo: r.serialNo,
    quantity: r.quantity === null ? "" : String(r.quantity),
    category: r.category,
    sourceRow: r.sourceRow,
    fileName: r.batch.fileName,
    updatedAt: r.updatedAt.toISOString(),
    updatedBy: nameOf(r.updatedById),
    updatedAtLabel: kstDateTime(r.updatedAt),
    hidden: r.deletedAt !== null,
    warnings: (r.importWarnings as ParseWarning[]).map((w) => ({
      field: w.field,
      message: w.message,
    })),
  };
}
