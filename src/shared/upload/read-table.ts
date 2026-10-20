// 엑셀(.xlsx)·CSV 파일 → 시트별 셀 표 (팀 공통 업로드 파서, 서버 전용)
// - 셀 값은 문자열·숫자·null 로만 바꾼다 (수식은 계산 결과, 날짜는 "YYYY-MM-DD")
// - .xls(옛 형식)는 읽지 않는다: 엑셀에서 .xlsx 로 다시 저장해 올리도록 안내
// - CSV 는 UTF-8(BOM 포함)과 엑셀 기본 저장 형식인 EUC-KR(CP949)을 자동 판별
import ExcelJS from "exceljs";

export type Cell = string | number | null;

export type SheetTable = {
  sheetName: string;
  rows: Cell[][];
};

export type ReadResult =
  { ok: true; sheets: SheetTable[] } | { ok: false; error: string };

/** 시트당 최대 행 수 (실수로 큰 파일을 올렸을 때 서버 보호) */
export const MAX_ROWS = 5000;

export async function readTableFile(
  fileName: string,
  data: ArrayBuffer,
): Promise<ReadResult> {
  const ext = fileName.toLowerCase().split(".").pop();
  try {
    if (ext === "xlsx") return { ok: true, sheets: await readXlsx(data) };
    if (ext === "csv") {
      return {
        ok: true,
        sheets: [{ sheetName: "CSV", rows: parseCsv(decodeText(data)) }],
      };
    }
    if (ext === "xls") {
      return {
        ok: false,
        error:
          ".xls(옛 엑셀 형식)는 읽을 수 없습니다. 엑셀에서 [다른 이름으로 저장] → .xlsx 로 저장한 뒤 올려 주세요.",
      };
    }
    return {
      ok: false,
      error: ".xlsx 또는 .csv 파일만 올릴 수 있습니다.",
    };
  } catch {
    return {
      ok: false,
      error:
        "파일을 읽지 못했습니다. 손상되었거나 암호가 걸린 파일인지 확인해 주세요.",
    };
  }
}

async function readXlsx(data: ArrayBuffer): Promise<SheetTable[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  return workbook.worksheets
    .filter((ws) => ws.state === "visible")
    .map((ws) => {
      const rows: Cell[][] = [];
      const last = Math.min(ws.rowCount, MAX_ROWS);
      for (let r = 1; r <= last; r += 1) {
        const row = ws.getRow(r);
        const cells: Cell[] = [];
        for (let c = 1; c <= ws.columnCount; c += 1) {
          cells.push(toCell(row.getCell(c).value));
        }
        rows.push(cells);
      }
      return { sheetName: ws.name, rows };
    });
}

/** exceljs 셀 값 → 문자열·숫자·null */
export function toCell(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string")
    return value.trim() === "" ? null : value.trim();
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value) return toCell(value.result as ExcelJS.CellValue);
    if ("richText" in value) {
      return toCell(value.richText.map((t) => t.text).join(""));
    }
    if ("text" in value) return toCell(value.text as string);
    if ("error" in value) return null;
  }
  return null;
}

/** UTF-8(BOM) 우선, 깨지면 EUC-KR(엑셀 한글 CSV 기본) */
export function decodeText(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  const start =
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(start),
    );
  } catch {
    return new TextDecoder("euc-kr").decode(bytes);
  }
}

/** CSV 파싱: 쉼표 구분, 큰따옴표로 감싼 값(쉼표·줄바꿈·"" 포함) 지원 */
export function parseCsv(text: string): Cell[][] {
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = "";
  let quoted = false;
  const pushField = () => {
    const v = field.trim();
    row.push(v === "" ? null : v);
    field = "";
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      pushField();
      rows.push(row);
      row = [];
      if (rows.length >= MAX_ROWS) return rows;
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    pushField();
    rows.push(row);
  }
  return rows;
}
