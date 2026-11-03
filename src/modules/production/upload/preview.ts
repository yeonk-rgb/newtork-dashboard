// 업로드 미리보기 (순수 함수 — 화면으로 넘기는 값만, DB 쓰기 없음). 친구 저장소 UploadPreviewView 응답과 같은 내용
import {
  allWarnings,
  classifiedErrors,
  recordKey,
  skippedCount,
  type Classified,
  type FieldDiff,
  type RowRef,
} from "./classify";
import type { ParseWarning } from "./parse-sheet";

export type PreviewRow = {
  key: string;
  sheet: string;
  row: number;
  serialNo: string;
  modelCode: string;
  seller: string;
  orderNo: string;
  dueDate: string | null;
  shippedDate: string | null;
  warnings: ParseWarning[];
};

export type UploadPreview = {
  fileName: string;
  /** 같은 파일(SHA-256)을 이미 올렸으면 그때 정보 — 저장 불가 */
  alreadyUploaded: { uploadedAt: string; uploadedBy: string } | null;
  sheets: {
    name: string;
    error: string | null;
    rows: number;
    skipped: number;
    duplicatesInFile: number;
  }[];
  summary: {
    created: number;
    changed: number;
    unchanged: number;
    hidden: number;
    skipped: number;
    errors: number;
    warnings: number;
    /** 새 행 중 출고일 없음 (실적에서 빠짐) */
    noShippedDate: number;
  };
  created: PreviewRow[];
  changed: (PreviewRow & { diffs: FieldDiff[] })[];
  hidden: PreviewRow[];
  errors: { sheet: string; row: number | null; message: string }[];
  warnings: (ParseWarning & { sheet: string; row: number; serialNo: string })[];
};

function previewRow({ sheet, row }: RowRef): PreviewRow {
  const v = row.values;
  return {
    key: recordKey(sheet, v.serialNo),
    sheet,
    row: row.row,
    serialNo: v.serialNo,
    modelCode: v.modelCode ?? "",
    seller: v.seller ?? "",
    orderNo: v.orderNo ?? "",
    dueDate: v.dueDate ?? null,
    shippedDate: v.shippedDate ?? null,
    warnings: row.warnings,
  };
}

export function buildPreview(
  fileName: string,
  c: Classified,
  alreadyUploaded: UploadPreview["alreadyUploaded"],
): UploadPreview {
  const errors = classifiedErrors(c);
  const warnings = allWarnings(c);
  return {
    fileName,
    alreadyUploaded,
    sheets: c.sheets.map((s) => ({
      name: s.name,
      error: s.error,
      rows: s.rows.length,
      skipped: s.skippedRows.length,
      duplicatesInFile: s.duplicateRows.length,
    })),
    summary: {
      created: c.created.length,
      changed: c.changed.length,
      unchanged: c.unchanged.length,
      hidden: c.hidden.length,
      skipped: skippedCount(c),
      errors: errors.length,
      warnings: warnings.length,
      noShippedDate: c.created.filter((r) => !r.row.values.shippedDate).length,
    },
    created: c.created.map(previewRow),
    changed: c.changed.map((r) => ({ ...previewRow(r), diffs: r.diffs })),
    hidden: c.hidden.map(previewRow),
    errors,
    warnings,
  };
}
