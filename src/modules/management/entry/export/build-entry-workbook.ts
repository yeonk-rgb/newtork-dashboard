// 월간 입력 엑셀 다운로드 — 원본 양식 파일을 열어 테마·글꼴·인쇄 설정은 그대로 두고 시트를 새로 그린다
// 서식은 원본 외상매입금 블록(C41~F41)·제목(C1)·머리글(C2)·메모(H3)에서 역할별로 복사 (새 색 없음)
import type ExcelJS from "exceljs";

import {
  applyColumns,
  COL,
  drawLayout,
  printSetup,
  sheetView,
} from "../../export/draw";
import {
  openTemplateWorkbook,
  readRoleStyles,
  readSheetBasics,
  writeWorkbook,
  type SheetBasics,
} from "../../export/template";
import { buildEntrySheetLayout, type EntryRole } from "./layout";
import type { EntrySheet } from "./plan";

/**
 * 역할 → 원본 셀 (2026-10-25). 원본 서식 불일치(미지급비용-직원 제목 9pt, 메모 9pt/10pt 섞임)는
 * 제목 C1(10pt)·메모 H3(10pt)로 통일. 금액 행은 외상매입금 블록(이름 9pt, 금액 #,##0 오른쪽, 총액 굵게 가운데)
 */
export const ENTRY_ROLE_CELLS: Record<EntryRole, string> = {
  title: "C1",
  header: "C2",
  name: "C41",
  amount: "D41",
  note: "E41",
  total: "F41",
  memo: "H3",
};

function drawEntrySheet(
  ws: ExcelJS.Worksheet,
  sheet: EntrySheet,
  roles: Record<EntryRole, Partial<ExcelJS.Style>>,
  basics: SheetBasics,
) {
  applyColumns(ws, basics, COL.H);
  drawLayout(ws, buildEntrySheetLayout(sheet), {
    roles,
    warnColor: basics.warnColor,
    heightOf: (spec) =>
      spec.kind === "separator" && spec.after !== undefined
        ? (basics.separatorHeights[spec.after] ?? basics.rowHeight)
        : basics.rowHeight,
  });
}

export async function buildEntryWorkbook(input: {
  template: Buffer;
  sheets: EntrySheet[];
  now: Date;
}): Promise<Buffer> {
  const { wb, source, dropSource } = await openTemplateWorkbook(input.template);
  const roles = readRoleStyles(source, ENTRY_ROLE_CELLS);
  const basics = readSheetBasics(source);
  dropSource();
  for (const sheet of input.sheets) {
    const ws = wb.addWorksheet(sheet.sheetName, {
      views: [sheetView()],
      // A4 가로: 너비 맞춤 시 세로는 약 70%, 가로는 100% (2026-10-25 Excel 인쇄 측정 — 원본과 다른 점)
      pageSetup: printSetup(basics.pageSetup, "landscape"),
    });
    drawEntrySheet(ws, sheet, roles, basics);
  }
  return writeWorkbook(wb, input.now);
}
