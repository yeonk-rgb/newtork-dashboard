// 채권·채무 엑셀 다운로드 — 원본 양식 파일을 열어 테마·글꼴·인쇄 설정은 그대로 두고, 월별 시트를 새로 그린다
// (exceljs 의 행 삽입은 병합을 제대로 옮기지 못해 원본 시트를 고치지 않고, 서식만 역할별로 복사한다)
import type ExcelJS from "exceljs";

import {
  applyColumns,
  drawLayout,
  extraColumnWidth,
  printSetup,
  sheetView,
} from "../../export/draw";
import { openTemplateWorkbook, writeWorkbook } from "../../export/template";
import {
  AR_STATUS_LABEL,
  EXPENSE_TYPE_LABEL,
  KIND_LABEL,
  PURCHASE_TYPE_LABEL,
} from "../labels";
import type { LedgerRow } from "../rules";
import { buildSheetLayout, COL, type RowSpec } from "./layout";
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

// 인쇄(printSetup): 월별 시트는 세로(I열을 넓혀 H·I열이 둘째 페이지로 넘어가지 않게), 상세 시트는 가로

function drawLedgerSheet(
  ws: ExcelJS.Worksheet,
  rows: LedgerRow[],
  styles: TemplateStyles,
) {
  const layout = buildSheetLayout(rows);
  applyColumns(ws, styles, COL.I);
  // A열 코드: 원본처럼 숨기되 서식은 글자(@) — 다시 입력해도 앞자리 0 유지 (원본과 다른 점)
  ws.getColumn(COL.A).numFmt = "@";
  ws.getColumn(COL.I).width = extraColumnWidth(layout.maxExtraAmount);
  drawLayout(ws, layout, {
    roles: styles.roles,
    heightOf: (spec) => rowHeight(spec, styles),
  });
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
 */
export async function buildLedgerWorkbook(input: {
  template: Buffer;
  sheets: ExportSheet[];
  now: Date;
}): Promise<Buffer> {
  const { wb, source, dropSource } = await openTemplateWorkbook(input.template);
  const styles = readTemplateStyles(source);
  dropSource();

  for (const sheet of input.sheets) {
    const ws = wb.addWorksheet(sheet.sheetName, {
      views: [sheetView()],
      pageSetup: printSetup(styles.pageSetup, "portrait"),
    });
    drawLedgerSheet(ws, sheet.rows, styles);
  }
  drawDetailSheet(
    wb.addWorksheet(DETAIL_SHEET_NAME, {
      pageSetup: printSetup(styles.pageSetup, "landscape"),
    }),
    input.sheets,
    styles,
  );
  return writeWorkbook(wb, input.now);
}
