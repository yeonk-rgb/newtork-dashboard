// 경영지원 엑셀 다운로드 공용 — 시트 배치(SheetLayout)를 exceljs 시트에 그리기
// 칸 서식은 역할별로 원본에서 복사한 것만 쓴다 (새 색·글꼴을 만들지 않음, 빨간 글씨도 원본 색)
import type ExcelJS from "exceljs";

import type { SheetBasics } from "./template";

/** 총액 칸 위치 — 병합 범위의 테두리(위·가운데·아래)를 정한다 */
export type TotalPart = "top" | "middle" | "bottom" | "single";

export type CellSpec<R extends string = string> = {
  /** 1부터 (A=1) */
  col: number;
  role: R;
  value?: string | number | null;
  formula?: { expr: string; result: number };
  /** 글자로 저장 (서식 "@") — 코드, 자동이체 적요 */
  asText?: boolean;
  totalPart?: TotalPart;
  /** 빨간 글씨 (원본 장기미수 색) — 주의할 숫자·안내 */
  warn?: boolean;
};

export type RowKind = "title" | "header" | "data" | "separator";

export type RowSpec<R extends string = string, A = string> = {
  row: number;
  kind: RowKind;
  /** 빈 행(구분) 앞 블록 — 블록 사이 빈 행 높이를 고를 때 쓴다 */
  after?: A;
  cells: CellSpec<R>[];
};

export type SheetLayout<R extends string = string, A = string> = {
  rows: RowSpec<R, A>[];
  /** "C1:F1" 같은 병합 범위 */
  merges: string[];
};

export const COL = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9 };

/**
 * 인쇄: A4, 너비 1페이지에 맞춤·높이는 자동 (2026-10-25 결정 — 원본은 배율 100%라 다른 점)
 * 여백은 원본 그대로
 */
export function printSetup(
  pageSetup: Partial<ExcelJS.PageSetup>,
  orientation: "portrait" | "landscape",
): Partial<ExcelJS.PageSetup> {
  return {
    ...pageSetup,
    paperSize: 9,
    orientation,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}

/** 원본처럼 숨긴 A열 다음 B1 부터, 확대 100% (topLeftCell 은 exceljs 타입에 없지만 저장됨) */
export function sheetView(): Partial<ExcelJS.WorksheetView> {
  return {
    state: "normal",
    topLeftCell: "B1",
    activeCell: "C1",
    zoomScale: 100,
  } as Partial<ExcelJS.WorksheetView>;
}

/** 보조 금액 열(I) 너비: 원본(기본 9)이면 큰 금액이 ####으로 보여 금액 글자 수에 맞춰 넓힌다 (원본과 다른 점) */
export function extraColumnWidth(maxAmount: number): number {
  const text = Math.round(maxAmount).toLocaleString("en-US");
  return Math.max(14, text.length + 4);
}

/** A~H 열 너비·숨김을 원본 그대로, lastCol 까지 원본 글꼴 열 서식 (exceljs 기본 글꼴 Calibri 대신 맑은 고딕) */
export function applyColumns(
  ws: ExcelJS.Worksheet,
  basics: Pick<SheetBasics, "columns" | "baseFont">,
  lastCol: number,
) {
  basics.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.width !== undefined) col.width = c.width;
    col.hidden = c.hidden;
  });
  for (let c = COL.A; c <= lastCol; c++) ws.getColumn(c).font = basics.baseFont;
}

/**
 * 총액 칸 테두리: 병합 범위 위(위·좌·우)/가운데(좌·우)/아래(좌·아래·우) — 원본 F5·F6·F24 와 같은 규칙.
 * 선 모양·색은 원본 총액 칸의 왼쪽 선을 그대로 쓴다
 */
function totalBorder(
  part: TotalPart,
  side: Partial<ExcelJS.Border>,
): Partial<ExcelJS.Borders> {
  return {
    left: side,
    right: side,
    ...(part === "top" || part === "single" ? { top: side } : {}),
    ...(part === "bottom" || part === "single" ? { bottom: side } : {}),
  };
}

export function applyCell<R extends string>(
  ws: ExcelJS.Worksheet,
  row: number,
  spec: CellSpec<R>,
  roles: Record<R, Partial<ExcelJS.Style>>,
  warnColor?: Partial<ExcelJS.Color>,
) {
  const cell = ws.getCell(row, spec.col);
  cell.style = structuredClone(roles[spec.role]);
  if (spec.totalPart) {
    const side = cell.border?.left ?? { style: "thin" };
    cell.border = totalBorder(spec.totalPart, side);
  }
  if (spec.asText) cell.numFmt = "@";
  if (spec.warn && warnColor) {
    cell.font = { ...cell.font, color: structuredClone(warnColor) };
  }
  if (spec.formula) {
    cell.value = { formula: spec.formula.expr, result: spec.formula.result };
  } else if (spec.value !== undefined && spec.value !== null) {
    cell.value = spec.value;
  }
}

/** 배치 전체 그리기: 행 높이 → 칸 → 병합 */
export function drawLayout<R extends string, A>(
  ws: ExcelJS.Worksheet,
  layout: SheetLayout<R, A>,
  opts: {
    roles: Record<R, Partial<ExcelJS.Style>>;
    heightOf: (spec: RowSpec<R, A>) => number | undefined;
    warnColor?: Partial<ExcelJS.Color>;
  },
) {
  for (const spec of layout.rows) {
    const height = opts.heightOf(spec);
    if (height !== undefined) ws.getRow(spec.row).height = height;
    for (const cell of spec.cells) {
      applyCell(ws, spec.row, cell, opts.roles, opts.warnColor);
    }
  }
  // 병합해도 칸마다 서식(총액 위·가운데·아래 테두리 등)이 남도록 — mergeCells 는 첫 칸 서식을 범위 전체에 복사한다
  for (const range of layout.merges) ws.mergeCellsWithoutStyle(range);
}
