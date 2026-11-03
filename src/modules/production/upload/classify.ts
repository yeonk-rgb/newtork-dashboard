// 엑셀 행 ↔ 저장된 제조내역 비교 (순수 함수). 친구 저장소 backend/production/services.py classify 그대로 +
// 숨긴 행(2026-11-03, 삭제 대신 숨김)과 같은 일련번호는 "숨김"으로 따로 — 저장하지 않고 제조내역 화면에서 복구
import { FIELD_LABEL, type RecordField } from "./columns";
import type { ParsedRow, ParsedSheet, RecordValues } from "./parse-sheet";

export type ExistingRecord = {
  id: string;
  values: RecordValues;
  hidden: boolean;
};

export type FieldDiff = {
  field: RecordField;
  label: string;
  before: string;
  after: string;
};

export type RowRef = { sheet: string; row: ParsedRow };

export type Classified = {
  sheets: ParsedSheet[];
  created: RowRef[];
  changed: (RowRef & { id: string; diffs: FieldDiff[] })[];
  unchanged: RowRef[];
  hidden: (RowRef & { id: string })[];
};

/** 행 식별 키 — 잠정 중복 키 시트 + 일련번호 (생산팀 specs/07 Q4) */
export const recordKey = (sheet: string, serialNo: string) =>
  `${sheet}::${serialNo}`;

const comparable = (v: string | null | undefined) => v ?? "";

export function diffValues(
  before: RecordValues,
  after: RecordValues,
  fields: RecordField[],
): FieldDiff[] {
  return fields
    .filter((f) => comparable(before[f]) !== comparable(after[f]))
    .map((f) => ({
      field: f,
      label: FIELD_LABEL[f],
      before: comparable(before[f]),
      after: comparable(after[f]),
    }));
}

export function classify(
  sheets: ParsedSheet[],
  existing: Map<string, ExistingRecord>,
): Classified {
  const result: Classified = {
    sheets,
    created: [],
    changed: [],
    unchanged: [],
    hidden: [],
  };
  for (const sheet of sheets) {
    if (sheet.error) continue;
    for (const row of sheet.rows) {
      const ref = { sheet: sheet.name, row };
      const record = existing.get(recordKey(sheet.name, row.values.serialNo));
      if (!record) {
        result.created.push(ref);
      } else if (record.hidden) {
        result.hidden.push({ ...ref, id: record.id });
      } else {
        const diffs = diffValues(record.values, row.values, sheet.fields);
        if (diffs.length > 0)
          result.changed.push({ ...ref, id: record.id, diffs });
        else result.unchanged.push(ref);
      }
    }
  }
  return result;
}

/** 오류 목록: 양식이 다른 시트 + 파일 안 중복 일련번호 */
export function classifiedErrors(c: Classified) {
  return [
    ...c.sheets
      .filter((s) => s.error)
      .map((s) => ({ sheet: s.name, row: null, message: s.error! })),
    ...c.sheets.flatMap((s) =>
      s.duplicateRows.map((d) => ({
        sheet: s.name,
        row: d.row,
        message: `일련번호 ${d.serialNo}이(가) ${d.firstRow}행과 중복되어 건너뛰었습니다.`,
      })),
    ),
  ];
}

export const skippedCount = (c: Classified) =>
  c.sheets
    .filter((s) => !s.error)
    .reduce((n, s) => n + s.skippedRows.length, 0);

export const allWarnings = (c: Classified) =>
  c.sheets.flatMap((s) =>
    s.rows.flatMap((r) =>
      r.warnings.map((w) => ({
        sheet: s.name,
        row: r.row,
        serialNo: r.values.serialNo,
        ...w,
      })),
    ),
  );
