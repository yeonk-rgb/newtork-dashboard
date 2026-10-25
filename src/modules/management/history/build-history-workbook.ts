// 변경 이력 엑셀 (순수 함수) — 「경영지원 관리」 원본 양식 스타일:
// 맑은 고딕 10, 머리글 회색(E7E6E6)+굵게, 얇은 테두리, 첫 행 고정, 자동 필터, 열 너비는 내용에 맞게
import ExcelJS from "exceljs";

import type { HistoryRow } from "./labels";

const FONT = { name: "맑은 고딕", size: 10 } as const;
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const COLUMNS: { header: string; value: (r: HistoryRow) => string | Date }[] = [
  { header: "일시", value: (r) => kstCellDate(r.occurredAt) },
  { header: "이름", value: (r) => r.actorName ?? "" },
  { header: "아이디", value: (r) => r.actorLoginId },
  { header: "화면", value: (r) => r.screen },
  { header: "동작", value: (r) => r.action },
  { header: "대상", value: (r) => r.target },
  { header: "바뀐 내용", value: (r) => r.lines.join("\n") },
];

const MIN_WIDTH = 8;
const MAX_WIDTH = 60;

/**
 * "2026-10-25 13:45"(한국 시간) → 엑셀 날짜 칸. 엑셀 날짜에는 시간대가 없으므로
 * 한국 시각 숫자 그대로 UTC 로 만들어 넣는다 (exceljs 는 UTC 값을 그대로 적는다)
 */
function kstCellDate(text: string): Date {
  return new Date(`${text.replace(" ", "T")}:00Z`);
}

/** 화면 너비 어림 — 한글·전각은 2칸, 그 외 1칸 */
function displayWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += /[ㄱ-ㅎ가-힣　-鿿＀-￯]/.test(ch) ? 2 : 1;
  return w;
}

export function columnWidths(rows: HistoryRow[]): number[] {
  return COLUMNS.map((col, i) => {
    const texts = [
      col.header,
      ...rows.map((r) => (i === 0 ? r.occurredAt : String(col.value(r)))),
    ];
    const widest = Math.max(
      ...texts.flatMap((t) => t.split("\n").map(displayWidth)),
    );
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, widest + 2));
  });
}

export async function buildHistoryWorkbook(
  rows: HistoryRow[],
  title: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title, {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "1:1",
    },
  });
  const widths = columnWidths(rows);
  sheet.columns = COLUMNS.map((col, i) => ({
    header: col.header,
    width: widths[i],
    style: { font: FONT },
  }));

  const header = sheet.getRow(1);
  header.eachCell((cell) => {
    cell.font = { ...FONT, bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE7E6E6" },
    };
    cell.border = BORDER;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  for (const r of rows) {
    const row = sheet.addRow(COLUMNS.map((col) => col.value(r)));
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = FONT;
      cell.border = BORDER;
      cell.alignment = { vertical: "top", wrapText: col === COLUMNS.length };
      if (col === 1) cell.numFmt = "yyyy-mm-dd hh:mm";
    });
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
