// 경영지원 엑셀 다운로드 공용 — "표를 세로로 쌓는" 시트(목표 대비 실적·미수금 통계 등)와 목록형 시트 그리기
// 서식은 원본 양식(경영지원_관리.xlsx)에서 역할별로 복사: 일반 행 = 외상매입금 블록(C41~F41), 빨간 행 = 장기미수(C3~F3)
// 원본에 없는 보조 칸(I열 금액·비율)은 총액(F)과 같은 굵은 글꼴에 테두리 없이 (채권·채무 다운로드의 "자동이체 합계"와 같은 규칙)
import type ExcelJS from "exceljs";

import { planPages, textUnits } from "./page-plan";
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
  addLedgerSheets,
  type ExportSheet,
} from "../ledger/export/build-ledger-workbook";
import { readTemplateStyles } from "../ledger/export/template";
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
  | "auxPercent"
  | "reportTitle"
  | "infoLabel"
  | "infoValue"
  | "trendAmount"
  | "footnote";

/** 역할 → 원본 셀 (2026-10-25). 제목 C1(10pt)·메모 H3(10pt)로 통일 — 월간 입력 다운로드와 같은 칸 */
export const STACKED_ROLE_CELLS: Record<
  Exclude<StackedRole, "auxAmount" | "auxPercent" | "reportTitle">,
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
  /** 월별 리포트 머리말 정보 칸: 라벨 = 머리글(C2), 값 = 거래처명 칸(C41, 9pt·네 면 테두리) */
  infoLabel: "C2",
  infoValue: "C41",
  /** 매출·지출 추이 표의 금액 칸 (D·E·F열 모두 잔액 칸 D41 서식) */
  trendAmount: "D41",
  /** 블록 아래 한 줄 안내 (원본 9pt 메모 H44) */
  footnote: "H44",
};

/** 블록 사이 빈 행 순서 (0 = 첫 블록 뒤 9.95, 1·2 = 9.75 — 원본 38·50·63행) */
export type StackedLayout = SheetLayout<StackedRole, number>;

export type StackedSheet = {
  name: string;
  layout: StackedLayout;
  /** I열(보조 금액)에 들어가는 가장 큰 금액 — 없으면 I열 너비 그대로 */
  maxAux?: number;
  /**
   * 블록 단위로 쪽을 나누는 시트(월별 리포트): Excel 은 "페이지에 맞춤"이면 수동 쪽 나눔을 무시하므로
   * 맞춤 대신 고정 배율 + 인쇄 범위 + 쪽 나눔 행 (2026-10-26 Excel 확인)
   */
  print?: { blocks: { first: number; last: number }[] };
};

/**
 * 블록 단위 쪽 나눔 시트의 인쇄 범위 끝 열 = I — 빈 열을 넣으면 옆 쪽으로 넘어가 빈 쪽이 생긴다(2026-10-26 확인).
 * 대신 H열 메모 중 가장 긴 글이 I열 끝 안에 들어가도록 I열을 넓힌다
 */
const PRINT_LAST_COL = "I";

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
  // 리포트 머리말 제목 "경 영 리 포 트": 원본 제목(C1)과 같은 글꼴을 16pt·가운데로 (견적서 제목 배치, 원본에 없는 크기)
  roles.reportTitle = {
    font: { ...structuredClone(roles.title.font), size: 16 },
    alignment: { horizontal: "center", vertical: "middle" },
  };
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
  /** 채권·채무 월별 시트 + 상세 시트 (월별 리포트 — 단독 다운로드와 같은 그리기 함수) */
  ledger?: { sheets: ExportSheet[]; detailName: string };
  lists?: ListSheet[];
  now: Date;
}): Promise<Buffer> {
  const { wb, source, dropSource } = await openTemplateWorkbook(input.template);
  const roles = stackedRoles(source);
  const basics = readSheetBasics(source);
  const ledgerStyles = input.ledger ? readTemplateStyles(source) : null;
  dropSource();

  for (const sheet of input.sheets) {
    const ws = wb.addWorksheet(sheet.name, {
      views: [sheetView()],
      pageSetup: printSetup(basics.pageSetup, "landscape"),
    });
    const hasAux = sheet.maxAux !== undefined || sheet.print !== undefined;
    applyColumns(ws, basics, hasAux ? COL.I : COL.H);
    if (hasAux) {
      let width = extraColumnWidth(sheet.maxAux ?? 0);
      if (sheet.print) {
        // H열 메모(라벨) 글이 H+I 안에 들어가게 (I열에 값이 있는 줄은 H 라벨만 보면 된다)
        const memoUnits = Math.max(
          0,
          ...sheet.layout.rows.flatMap((r) =>
            r.cells
              .filter((c) => c.col === COL.H && typeof c.value === "string")
              .map((c) => textUnits(String(c.value))),
          ),
        );
        const hWidth = basics.columns[COL.H - 1]?.width ?? 15.5;
        width = Math.max(width, Math.ceil(memoUnits + 2 - hWidth));
      }
      ws.getColumn(COL.I).width = width;
    }
    drawLayout(ws, sheet.layout, {
      roles,
      warnColor: basics.warnColor,
      heightOf: (spec) =>
        spec.kind === "separator" && spec.after !== undefined
          ? (basics.separatorHeights[spec.after] ?? basics.rowHeight)
          : basics.rowHeight,
    });
    if (sheet.print) {
      const lastRow = sheet.layout.rows.length;
      const columnWidths = Array.from({ length: COL.I }, (_, i) => {
        const col = ws.getColumn(i + 1);
        return col.hidden ? 0 : (col.width ?? 9);
      });
      const rowHeights = Array.from(
        { length: lastRow },
        (_, i) => ws.getRow(i + 1).height ?? basics.rowHeight ?? 15,
      );
      const plan = planPages({
        columnWidths,
        rowHeights,
        blocks: sheet.print.blocks,
        orientation: "landscape",
        margins: {
          left: basics.pageSetup.margins?.left ?? 0.7,
          right: basics.pageSetup.margins?.right ?? 0.7,
          top: basics.pageSetup.margins?.top ?? 0.75,
          bottom: basics.pageSetup.margins?.bottom ?? 0.75,
        },
      });
      ws.pageSetup = {
        ...ws.pageSetup,
        fitToPage: false,
        scale: plan.scale,
        printArea: `A1:${PRINT_LAST_COL}${lastRow}`,
      };
      for (const row of plan.breaks) ws.getRow(row).addPageBreak();
    }
  }
  if (input.ledger && ledgerStyles) {
    addLedgerSheets(
      wb,
      ledgerStyles,
      input.ledger.sheets,
      input.ledger.detailName,
    );
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
