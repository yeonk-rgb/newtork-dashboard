// 엑셀(.xlsx) → 서식까지 담은 시트 (팀 공통 업로드 파서, 서버 전용)
// read-table.ts 는 값만 읽는다. 양식의 병합 셀·글자색·배경색·수식·표시 형식으로 의미를 나타내는 파일
// (예: 경영지원_관리.xlsx 의 빨간 글씨 = 장기미수, 연두 배경 = 자동이체)은 이 함수로 읽는다
import ExcelJS from "exceljs";

/** 엑셀 색: 직접 지정 색(ARGB) 또는 테마 색(번호 + 명도 조절) */
export type SheetColor = { argb?: string; theme?: number; tint?: number };

export type StyledCell = {
  /** 표시 값 — 수식은 저장된 계산값(없으면 null), 서식 있는 글자는 글자만 */
  value: string | number | Date | boolean | null;
  /** 수식 (= 없이). 수식이 아니면 없음 */
  formula?: string;
  /** 수식인데 파일에 계산값이 저장돼 있는지 (엑셀이 아닌 도구로 만든 파일은 없을 수 있음) */
  hasResult?: boolean;
  numFmt?: string;
  font?: SheetColor;
  fill?: SheetColor;
};

/** 병합 범위 (1부터 시작하는 행·열 번호) */
export type MergeRange = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

export type StyledSheet = {
  name: string;
  rowCount: number;
  columnCount: number;
  /** "행:열" → 셀 (값·서식이 모두 없는 칸은 없음). 병합된 칸은 첫 칸에만 값이 있다 */
  cells: Map<string, StyledCell>;
  merges: MergeRange[];
  /** 숨김 열 번호 */
  hiddenColumns: number[];
};

export type StyledReadResult =
  { ok: true; sheets: StyledSheet[] } | { ok: false; error: string };

/** 시트당 최대 행 수 (read-table.ts 와 같은 기준) */
export const MAX_STYLED_ROWS = 5000;

export const cellKey = (row: number, col: number) => `${row}:${col}`;

export function getCell(
  sheet: StyledSheet,
  row: number,
  col: number,
): StyledCell | undefined {
  return sheet.cells.get(cellKey(row, col));
}

/** 그 칸이 속한 병합 범위 (없으면 null) */
export function mergeAt(
  sheet: StyledSheet,
  row: number,
  col: number,
): MergeRange | null {
  return (
    sheet.merges.find(
      (m) => row >= m.top && row <= m.bottom && col >= m.left && col <= m.right,
    ) ?? null
  );
}

/** "F3:F4" → 범위. 형식이 틀리면 null */
export function parseRange(ref: string): MergeRange | null {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref);
  if (!match) return null;
  const col = (letters: string) =>
    [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  return {
    top: Number(match[2]),
    left: col(match[1]),
    bottom: Number(match[4]),
    right: col(match[3]),
  };
}

export function columnLetter(col: number): string {
  let s = "";
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

function toColor(
  color: Partial<ExcelJS.Color> | undefined,
): SheetColor | undefined {
  if (!color) return undefined;
  const c = color as { argb?: string; theme?: number; tint?: number };
  if (c.argb) return { argb: c.argb.toUpperCase() };
  if (c.theme !== undefined) {
    return { theme: c.theme, ...(c.tint ? { tint: c.tint } : {}) };
  }
  return undefined;
}

/** exceljs 셀 값 → 표시 값 + 수식 정보 */
function readValue(
  raw: ExcelJS.CellValue,
): Pick<StyledCell, "value" | "formula" | "hasResult"> {
  if (raw === null || raw === undefined) return { value: null };
  if (
    typeof raw === "string" ||
    typeof raw === "number" ||
    typeof raw === "boolean" ||
    raw instanceof Date
  ) {
    return { value: raw };
  }
  if ("formula" in raw || "sharedFormula" in raw) {
    const f = raw as {
      formula?: string;
      sharedFormula?: string;
      result?: unknown;
    };
    const result = f.result;
    const hasResult = result !== undefined && result !== null;
    const value =
      typeof result === "string" ||
      typeof result === "number" ||
      typeof result === "boolean" ||
      result instanceof Date
        ? result
        : null;
    return { value, formula: f.formula ?? f.sharedFormula, hasResult };
  }
  if ("richText" in raw) {
    return { value: raw.richText.map((t) => t.text).join("") };
  }
  if ("text" in raw) return { value: String(raw.text) };
  if ("error" in raw) return { value: null };
  return { value: null };
}

export async function readStyledXlsx(
  fileName: string,
  data: ArrayBuffer,
): Promise<StyledReadResult> {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext !== "xlsx") {
    return {
      ok: false,
      error:
        ext === "xls"
          ? ".xls(옛 엑셀 형식)는 읽을 수 없습니다. 엑셀에서 [다른 이름으로 저장] → .xlsx 로 저장한 뒤 올려 주세요."
          : ".xlsx 파일만 올릴 수 있습니다.",
    };
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    return {
      ok: false,
      error:
        "엑셀 파일을 열 수 없습니다. 파일이 손상되었거나 암호가 걸려 있는지 확인하세요.",
    };
  }

  const sheets: StyledSheet[] = [];
  for (const ws of workbook.worksheets) {
    if (ws.rowCount > MAX_STYLED_ROWS) {
      return {
        ok: false,
        error: `${ws.name} 시트가 ${MAX_STYLED_ROWS.toLocaleString()}행을 넘습니다. 양식 파일이 맞는지 확인하세요.`,
      };
    }
    const merges = (ws.model.merges ?? [])
      .map(parseRange)
      .filter((m): m is MergeRange => m !== null);
    // 병합된 칸 중 첫 칸이 아닌 칸은 exceljs 가 첫 칸 값을 그대로 돌려주므로 비운다
    const isSlave = (row: number, col: number) =>
      merges.some(
        (m) =>
          row >= m.top &&
          row <= m.bottom &&
          col >= m.left &&
          col <= m.right &&
          (row !== m.top || col !== m.left),
      );

    const cells = new Map<string, StyledCell>();
    ws.eachRow({ includeEmpty: true }, (row, r) => {
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        const read = isSlave(r, c) ? { value: null } : readValue(cell.value);
        const font = toColor(cell.font?.color);
        const fill =
          cell.fill?.type === "pattern" && cell.fill.pattern !== "none"
            ? toColor(cell.fill.fgColor)
            : undefined;
        const numFmt =
          cell.numFmt && cell.numFmt !== "General" ? cell.numFmt : undefined;
        if (read.value === null && !read.formula && !font && !fill) return;
        cells.set(cellKey(r, c), {
          ...read,
          ...(numFmt ? { numFmt } : {}),
          ...(font ? { font } : {}),
          ...(fill ? { fill } : {}),
        });
      });
    });

    const hiddenColumns: number[] = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      if (ws.getColumn(c).hidden) hiddenColumns.push(c);
    }

    sheets.push({
      name: ws.name,
      rowCount: ws.rowCount,
      columnCount: ws.columnCount,
      cells,
      merges,
      hiddenColumns,
    });
  }
  return { ok: true, sheets };
}
