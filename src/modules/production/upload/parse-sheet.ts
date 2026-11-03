// 제조내역 엑셀 → 시트별 행 (순수 함수 — DB 모름). 친구 저장소 backend/production/excel.py 규칙 그대로:
// - 명확한 경우만 형식을 바꾸고, 읽을 수 없는 값은 비워 두되 원래 값과 함께 경고로 남긴다
// - 일련번호가 없는 행은 건너뜀, 같은 시트 안 같은 일련번호는 두 번째부터 오류(건너뜀)
// - 셀 값은 shared/upload/read-table.ts 가 바꾼 형태(문자열·숫자·null, 날짜 셀은 "YYYY-MM-DD")
import type { Cell, SheetTable } from "@/shared/upload/read-table";

import {
  COLUMNS,
  EXTRA_HEADERS,
  FIRST_DATA_ROW,
  HEADER_ROW_1,
  HEADER_ROW_2,
  LAST_COLUMN,
  ZERO_PADDED_FIELDS,
  columnIndex,
  type Column,
  type RecordField,
} from "./columns";

/** 저장할 값 — 날짜 칸은 "YYYY-MM-DD" 또는 null, 나머지는 글자("" = 빈 값) */
export type RecordValues = Partial<Record<RecordField, string | null>>;

export type ParseWarning = {
  field: RecordField;
  label: string;
  raw: string;
  message: string;
};

export type ParsedRow = {
  /** 엑셀 행 번호 */
  row: number;
  values: RecordValues & { serialNo: string };
  warnings: ParseWarning[];
};

export type ParsedSheet = {
  name: string;
  /** 양식 불일치 사유 — 이 시트는 저장하지 않는다 */
  error: string | null;
  /** 이 시트에서 읽은 칸 (보조 열은 머리글이 맞을 때만) */
  fields: RecordField[];
  rows: ParsedRow[];
  /** 일련번호가 없어 건너뛴 행 번호 */
  skippedRows: number[];
  duplicateRows: { row: number; serialNo: string; firstRow: number }[];
};

const DATE_TEXT = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/;

const text = (v: Cell) => (v === null ? "" : String(v).trim());
const isBlank = (v: Cell) => v === null || (typeof v === "string" && !v.trim());

function numberText(v: Cell): string {
  if (typeof v === "number" && Number.isInteger(v)) return String(v);
  return text(v);
}

const warning = (c: Column, raw: Cell, message: string): ParseWarning => ({
  field: c.field,
  label: c.label,
  raw: text(raw),
  message,
});

/** 셀 하나 → 저장할 값 + 경고 */
export function convert(
  c: Column,
  raw: Cell,
): { value: string | null; warning: ParseWarning | null } {
  if (isBlank(raw)) {
    return { value: c.kind === "date" ? null : "", warning: null };
  }
  switch (c.kind) {
    case "date": {
      const m = typeof raw === "string" ? DATE_TEXT.exec(raw) : null;
      if (m) {
        const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const dt = new Date(Date.UTC(y, mo - 1, d));
        if (dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) {
          return { value: dt.toISOString().slice(0, 10), warning: null };
        }
      }
      return {
        value: null,
        warning: warning(
          c,
          raw,
          `${c.label} 값 "${text(raw)}"을(를) 날짜로 읽을 수 없어 비워 두었습니다.`,
        ),
      };
    }
    case "bush":
      // 작성방법: 숫자 6자리, 한 자리 수는 앞에 0. 숫자 셀은 앞의 0이 사라지므로 6자리로 복원
      if (
        typeof raw === "number" &&
        Number.isInteger(raw) &&
        raw >= 0 &&
        raw < 1_000_000
      ) {
        return { value: String(raw).padStart(6, "0"), warning: null };
      }
      return { value: numberText(raw), warning: null };
    case "numberText":
      return { value: numberText(raw), warning: null };
    case "text":
      if (typeof raw === "number") {
        const value = numberText(raw);
        return {
          value,
          warning: ZERO_PADDED_FIELDS.has(c.field)
            ? warning(
                c,
                raw,
                `${c.label}이(가) 숫자 셀로 입력되어 앞자리 0이 빠졌을 수 있습니다.`,
              )
            : null,
        };
      }
      return { value: text(raw), warning: null };
  }
}

function checkHeaders(headers: Map<number, Cell[]>) {
  const cell = (row: number, letter: string) =>
    text(headers.get(row)?.[columnIndex(letter)] ?? null);
  const problems: string[] = [];
  for (const h of EXTRA_HEADERS) {
    if (cell(h.row, h.letter) !== h.header) {
      problems.push(
        `${h.letter}${h.row} 칸은 "${h.header}"이어야 하는데 "${cell(h.row, h.letter)}"입니다.`,
      );
    }
  }
  const columns: Column[] = [];
  for (const c of COLUMNS) {
    const actual = cell(c.headerRow, c.letter);
    if (actual === c.header) columns.push(c);
    else if (c.required) {
      problems.push(
        `${c.letter}${c.headerRow} 칸은 "${c.header}"이어야 하는데 "${actual}"입니다.`,
      );
    }
  }
  return { problems, columns };
}

export function parseSheet(table: SheetTable): ParsedSheet {
  const sheet: ParsedSheet = {
    name: table.sheetName,
    error: null,
    fields: [],
    rows: [],
    skippedRows: [],
    duplicateRows: [],
  };
  const headers = new Map<number, Cell[]>([
    [HEADER_ROW_1, table.rows[HEADER_ROW_1 - 1] ?? []],
    [HEADER_ROW_2, table.rows[HEADER_ROW_2 - 1] ?? []],
  ]);
  const { problems, columns } = checkHeaders(headers);
  if (problems.length > 0) {
    sheet.error = `제조내역 양식과 다릅니다. ${problems.slice(0, 5).join(" ")}`;
    return sheet;
  }
  sheet.fields = columns.map((c) => c.field);

  const seen = new Map<string, number>();
  for (let i = FIRST_DATA_ROW - 1; i < table.rows.length; i++) {
    const rowNo = i + 1;
    const cells = table.rows[i] ?? [];
    // B~Y 가 모두 비면 빈 행 (A열 순번만 있는 빈 양식 행 포함)
    if (cells.slice(1, LAST_COLUMN).every((v) => isBlank(v ?? null))) continue;

    const values: RecordValues = {};
    const warnings: ParseWarning[] = [];
    for (const c of columns) {
      const r = convert(c, cells[columnIndex(c.letter)] ?? null);
      values[c.field] = r.value;
      if (r.warning) warnings.push(r.warning);
    }
    const serialNo = values.serialNo ?? "";
    if (!serialNo) {
      sheet.skippedRows.push(rowNo);
      continue;
    }
    const first = seen.get(serialNo);
    if (first !== undefined) {
      sheet.duplicateRows.push({ row: rowNo, serialNo, firstRow: first });
      continue;
    }
    seen.set(serialNo, rowNo);
    sheet.rows.push({ row: rowNo, values: { ...values, serialNo }, warnings });
  }
  return sheet;
}

/** 파일 전체 — 양식에 맞는 시트가 하나도 없으면 오류 */
export function parseWorkbook(
  tables: SheetTable[],
): { ok: true; sheets: ParsedSheet[] } | { ok: false; error: string } {
  const sheets = tables.map(parseSheet);
  if (!sheets.some((s) => s.error === null)) {
    const reasons = sheets.map((s) => `[${s.name}] ${s.error}`).join(" / ");
    return {
      ok: false,
      error: `제조내역 양식에 맞는 시트가 없습니다. ${reasons}`,
    };
  }
  return { ok: true, sheets };
}
