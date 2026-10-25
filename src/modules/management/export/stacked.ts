// 경영지원 엑셀 다운로드 공용 — "표를 세로로 쌓는" 시트(목표 대비 실적·미수금 통계 등)와 목록형 시트 그리기
// 서식은 원본 양식(경영지원_관리.xlsx)에서 역할별로 복사: 일반 행 = 외상매입금 블록(C41~F41), 빨간 행 = 장기미수(C3~F3)
// 원본에 없는 보조 칸(I열 금액·비율)은 총액(F)과 같은 굵은 글꼴에 테두리 없이 (채권·채무 다운로드의 "자동이체 합계"와 같은 규칙)
import type ExcelJS from "exceljs";

import {
  applyColumns,
  COL,
  drawLayout,
  extraColumnWidth,
  printSetup,
  sheetView,
  type SheetLayout,
} from "./draw";
import {
  openTemplateWorkbook,
  readRoleStyles,
  readSheetBasics,
  writeWorkbook,
  type SheetBasics,
} from "./template";

export type StackedRole =
  | "title"
  | "header"
  | "name"
  | "amount"
  | "note"
  | "total"
  | "memo"
  | "warnName"
  | "warnAmount"
  | "warnNote"
  | "warnTotal"
  | "auxLabel"
  | "auxAmount"
  | "auxPercent";

/** 역할 → 원본 셀 (2026-10-25). 제목 C1(10pt)·메모 H3(10pt)로 통일 — 월간 입력 다운로드와 같은 칸 */
export const STACKED_ROLE_CELLS: Record<
  Exclude<StackedRole, "auxAmount" | "auxPercent">,
  string
> = {
  title: "C1",
  header: "C2",
  name: "C41",
  amount: "D41",
  note: "E41",
  total: "F41",
  memo: "H3",
  warnName: "C3",
  warnAmount: "D3",
  warnNote: "E3",
  warnTotal: "F3",
  auxLabel: "H3",
};

/** 블록 사이 빈 행 순서 (0 = 첫 블록 뒤 9.95, 1·2 = 9.75 — 원본 38·50·63행) */
export type StackedLayout = SheetLayout<StackedRole, number>;

export type StackedSheet = {
  name: string;
  layout: StackedLayout;
  /** I열(보조 금액)에 들어가는 가장 큰 금액 — 없으면 I열 너비 그대로 */
  maxAux?: number;
};

/** 목록형 시트 (첫 행 고정·자동 필터 — 원본에 없는 칸을 모은 표, 채권·채무 "상세" 시트와 같은 모양) */
export type ListSheet = {
  name: string;
  columns: { header: string; width: number; numFmt?: string }[];
  rows: (string | number | null)[][];
};

function stackedRoles(source: ExcelJS.Worksheet) {
  const roles = readRoleStyles(source, STACKED_ROLE_CELLS) as Record<
    StackedRole,
    Partial<ExcelJS.Style>
  >;
  const total = roles.total;
  const aux = {
    font: structuredClone(total.font),
    alignment: { horizontal: "right", vertical: "middle" },
  } as const;
  roles.auxAmount = { ...aux, numFmt: total.numFmt ?? "#,##0" };
  roles.auxPercent = { ...aux, numFmt: "0.0%" };
  return roles;
}

function drawList(
  ws: ExcelJS.Worksheet,
  sheet: ListSheet,
  header: Partial<ExcelJS.Style>,
  basics: SheetBasics,
) {
  ws.columns = sheet.columns.map((c) => ({
    width: c.width,
    style: { font: basics.baseFont },
  }));
  sheet.columns.forEach((c, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.style = structuredClone(header);
    cell.value = c.header;
  });
  sheet.rows.forEach((values, r) => {
    values.forEach((v, i) => {
      const cell = ws.getCell(r + 2, i + 1);
      cell.font = basics.baseFont;
      const fmt = sheet.columns[i].numFmt;
      if (fmt) cell.numFmt = fmt;
      if (v !== null && v !== "") cell.value = v;
    });
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };
}

/**
 * 원본 양식 파일(bytes) + 쌓기형 시트들 (+ 목록형 시트) → .xlsx
 * 인쇄: A4 가로 + 너비 1페이지 맞춤 (월간 입력과 같은 기준 — 세로는 약 70%)
 */
export async function buildStackedWorkbook(input: {
  template: Buffer;
  sheets: StackedSheet[];
  lists?: ListSheet[];
  now: Date;
}): Promise<Buffer> {
  const { wb, source, dropSource } = await openTemplateWorkbook(input.template);
  const roles = stackedRoles(source);
  const basics = readSheetBasics(source);
  dropSource();

  for (const sheet of input.sheets) {
    const ws = wb.addWorksheet(sheet.name, {
      views: [sheetView()],
      pageSetup: printSetup(basics.pageSetup, "landscape"),
    });
    const hasAux = sheet.maxAux !== undefined;
    applyColumns(ws, basics, hasAux ? COL.I : COL.H);
    if (hasAux) ws.getColumn(COL.I).width = extraColumnWidth(sheet.maxAux!);
    drawLayout(ws, sheet.layout, {
      roles,
      warnColor: basics.warnColor,
      heightOf: (spec) =>
        spec.kind === "separator" && spec.after !== undefined
          ? (basics.separatorHeights[spec.after] ?? basics.rowHeight)
          : basics.rowHeight,
    });
  }
  for (const list of input.lists ?? []) {
    drawList(
      wb.addWorksheet(list.name, {
        pageSetup: printSetup(basics.pageSetup, "landscape"),
      }),
      list,
      roles.header,
      basics,
    );
  }
  return writeWorkbook(wb, input.now);
}
