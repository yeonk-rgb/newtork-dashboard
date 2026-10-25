// 채권·채무 엑셀 다운로드 — 원본 양식 파일을 열어 테마·글꼴·인쇄 설정은 그대로 두고, 월별 시트를 새로 그린다
// (exceljs 의 행 삽입은 병합을 제대로 옮기지 못해 원본 시트를 고치지 않고, 서식만 역할별로 복사한다)
import ExcelJS from "exceljs";

import {
  AR_STATUS_LABEL,
  EXPENSE_TYPE_LABEL,
  KIND_LABEL,
  PURCHASE_TYPE_LABEL,
} from "../labels";
import type { LedgerRow } from "../rules";
import { buildSheetLayout, COL, type CellSpec, type RowSpec } from "./layout";
import { readTemplateStyles, type TemplateStyles } from "./template";

export type ExportSheet = {
  /** 시트 이름 ("2026-10") — 2단계 업로드가 기준년월과 같은 이름의 시트를 자동으로 고른다 */
  sheetName: string;
  /** 상세 시트의 기준년월 칸 ("2026-10") */
  month: string;
  /** 숨긴 행 제외, 화면 순서 */
  rows: LedgerRow[];
};

export const DETAIL_SHEET_NAME = "상세";

/**
 * 인쇄: A4, 너비 1페이지에 맞춤·높이는 자동 (2026-10-25 결정 — 원본과 다른 점)
 * 월별 시트는 세로(I열을 넓혀 H·I열이 둘째 페이지로 넘어가지 않게), 상세 시트는 가로. 여백은 원본 그대로
 */
export function printSetup(
  styles: Pick<TemplateStyles, "pageSetup">,
  orientation: "portrait" | "landscape",
): Partial<ExcelJS.PageSetup> {
  return {
    ...styles.pageSetup,
    paperSize: 9,
    orientation,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}

/** I열 너비: 원본(기본 9)이면 큰 금액이 ####으로 보여 금액 글자 수에 맞춰 넓힌다 (원본과 다른 점) */
export function extraColumnWidth(maxAmount: number): number {
  const text = Math.round(maxAmount).toLocaleString("en-US");
  return Math.max(14, text.length + 4);
}

/**
 * 총액 칸 테두리: 병합 범위 위(위·좌·우)/가운데(좌·우)/아래(좌·아래·우) — 원본 F5·F6·F24 와 같은 규칙.
 * 선 모양·색은 원본 총액 칸의 왼쪽 선을 그대로 쓴다
 */
function totalBorder(
  part: CellSpec["totalPart"],
  side: Partial<ExcelJS.Border>,
): Partial<ExcelJS.Borders> {
  return {
    left: side,
    right: side,
    ...(part === "top" || part === "single" ? { top: side } : {}),
    ...(part === "bottom" || part === "single" ? { bottom: side } : {}),
  };
}

function applyCell(
  ws: ExcelJS.Worksheet,
  row: number,
  spec: CellSpec,
  styles: TemplateStyles,
) {
  const cell = ws.getCell(row, spec.col);
  cell.style = structuredClone(styles.roles[spec.role]);
  if (spec.totalPart) {
    const side = cell.border?.left ?? { style: "thin" };
    cell.border = totalBorder(spec.totalPart, side);
  }
  if (spec.asText) cell.numFmt = "@";
  if (spec.formula) {
    cell.value = { formula: spec.formula.expr, result: spec.formula.result };
  } else if (spec.value !== undefined && spec.value !== null) {
    cell.value = spec.value;
  }
}

function drawLedgerSheet(
  ws: ExcelJS.Worksheet,
  rows: LedgerRow[],
  styles: TemplateStyles,
) {
  const layout = buildSheetLayout(rows);

  styles.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.width !== undefined) col.width = c.width;
    col.hidden = c.hidden;
  });
  // 새로 입력하는 칸도 원본 글꼴(맑은 고딕)로 — exceljs 가 쓰는 통합 문서 기본 글꼴은 Calibri 라 열 서식으로 덮는다
  for (let c = COL.A; c <= COL.I; c++) ws.getColumn(c).font = styles.baseFont;
  // A열 코드: 원본처럼 숨기되 서식은 글자(@) — 다시 입력해도 앞자리 0 유지 (원본과 다른 점)
  ws.getColumn(COL.A).numFmt = "@";
  ws.getColumn(COL.I).width = extraColumnWidth(layout.maxExtraAmount);

  for (const spec of layout.rows) {
    const height = rowHeight(spec, styles);
    if (height !== undefined) ws.getRow(spec.row).height = height;
    for (const cell of spec.cells) applyCell(ws, spec.row, cell, styles);
  }
  // 병합해도 칸마다 서식(총액 위·가운데·아래 테두리 등)이 남도록 — mergeCells 는 첫 칸 서식을 범위 전체에 복사한다
  for (const range of layout.merges) ws.mergeCellsWithoutStyle(range);
}

function rowHeight(spec: RowSpec, styles: TemplateStyles) {
  if (spec.kind !== "separator") return styles.rowHeight;
  return spec.after && spec.after !== "ACCRUED_VENDOR"
    ? styles.separatorHeights[spec.after]
    : styles.rowHeight;
}

const DETAIL_COLUMNS: {
  header: string;
  width: number;
  numFmt?: string;
  value: (r: LedgerRow, month: string) => string | number | null;
}[] = [
  { header: "기준년월", width: 10, numFmt: "@", value: (_, m) => m },
  { header: "구분", width: 15, value: (r) => KIND_LABEL[r.kind] },
  { header: "코드", width: 12, numFmt: "@", value: (r) => r.partnerCode },
  { header: "거래처명", width: 26, value: (r) => r.partnerName },
  {
    header: "잔액",
    width: 15,
    numFmt: "#,##0",
    value: (r) => Number(r.amount),
  },
  { header: "적요", width: 30, numFmt: "@", value: (r) => r.note },
  {
    header: "상태",
    width: 13,
    value: (r) => (r.arStatus ? AR_STATUS_LABEL[r.arStatus] : null),
  },
  {
    header: "매입유형",
    width: 11,
    value: (r) => (r.purchaseType ? PURCHASE_TYPE_LABEL[r.purchaseType] : null),
  },
  {
    header: "비용유형",
    width: 11,
    value: (r) => (r.expenseType ? EXPENSE_TYPE_LABEL[r.expenseType] : null),
  },
  {
    header: "자동이체",
    width: 9,
    value: (r) => (r.kind === "ACCRUED_VENDOR" && r.autoTransfer ? "○" : null),
  },
  { header: "예정일", width: 12, numFmt: "@", value: (r) => r.dueOn },
  { header: "완료일", width: 12, numFmt: "@", value: (r) => r.settledOn },
  {
    header: "엑셀 이관",
    width: 9,
    value: (r) => (r.fromUpload ? "○" : null),
  },
  { header: "최종 수정", width: 12, value: (r) => r.updatedBy },
];

/** 원본에 없는 칸(상태·유형·자동이체·예정일·완료일 등)을 모은 표 — 2단계 업로드는 블록 제목이 없어 읽지 않는다 */
function drawDetailSheet(
  ws: ExcelJS.Worksheet,
  sheets: ExportSheet[],
  styles: TemplateStyles,
) {
  ws.columns = DETAIL_COLUMNS.map((c) => ({
    width: c.width,
    style: { font: styles.baseFont },
  }));
  const header = ws.getRow(1);
  DETAIL_COLUMNS.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.style = structuredClone(styles.roles.header);
    cell.value = c.header;
  });
  let row = 2;
  for (const sheet of sheets) {
    for (const r of sheet.rows) {
      DETAIL_COLUMNS.forEach((c, i) => {
        const cell = ws.getCell(row, i + 1);
        cell.font = styles.baseFont;
        if (c.numFmt) cell.numFmt = c.numFmt;
        const v = c.value(r, sheet.month);
        if (v !== null && v !== "") cell.value = v;
      });
      row++;
    }
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: DETAIL_COLUMNS.length },
  };
}

/**
 * 원본 양식 파일(bytes) + 월별 행 → .xlsx
 * - 월별 시트("2026-10") + 맨 뒤 "상세" 시트
 * - 엑셀이 열 때 다시 계산하도록 fullCalcOnLoad (계산값도 함께 저장돼 있어 바로 숫자가 보임)
 */
export async function buildLedgerWorkbook(input: {
  template: Buffer;
  sheets: ExportSheet[];
  now: Date;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(input.template as unknown as ArrayBuffer);
  const source = wb.worksheets[0];
  const styles = readTemplateStyles(source);
  wb.removeWorksheet(source.id);

  for (const sheet of input.sheets) {
    // 원본처럼 숨긴 A열 다음 B1 부터, 확대 100% (topLeftCell 은 exceljs 타입에 없지만 저장됨)
    const view = {
      state: "normal",
      topLeftCell: "B1",
      activeCell: "C1",
      zoomScale: 100,
    } as Partial<ExcelJS.WorksheetView>;
    const ws = wb.addWorksheet(sheet.sheetName, {
      views: [view],
      pageSetup: printSetup(styles, "portrait"),
    });
    drawLedgerSheet(ws, sheet.rows, styles);
  }
  drawDetailSheet(
    wb.addWorksheet(DETAIL_SHEET_NAME, {
      pageSetup: printSetup(styles, "landscape"),
    }),
    input.sheets,
    styles,
  );

  wb.creator = "NEWTORK 경영 대시보드";
  wb.lastModifiedBy = "NEWTORK 경영 대시보드";
  wb.created = input.now;
  wb.modified = input.now;
  wb.calcProperties.fullCalcOnLoad = true;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
