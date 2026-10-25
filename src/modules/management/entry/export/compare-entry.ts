// 월간 입력 다운로드 ↔ 원본 양식 셀 단위 비교 목록 (테스트·npm run export:report 공용)
// 새 파일의 칸 위치는 배치(layout)에서 찾는다 — 행 번호를 고정하지 않음
import type ExcelJS from "exceljs";

import {
  compareRoles,
  compareSheetBasics,
  stable,
  type CompareRow,
  type RolePair,
} from "../../export/compare";
import type { CellSpec, TotalPart } from "../../export/draw";
import { ENTRY_ROLE_CELLS } from "./build-entry-workbook";
import { buildEntrySheetLayout, type EntryRole } from "./layout";
import type { EntrySheet } from "./plan";

const PRINT_REASON =
  "A4 너비 1페이지 맞춤·높이 자동 (2026-10-25 결정, 원본은 배율 100%)";
const ORIENTATION_REASON =
  "A4 가로 — 너비 맞춤 시 세로는 약 70%(글자 7pt), 가로는 100%로 인쇄돼서 (2026-10-25 Excel 측정·결정)";

/** 총액 칸 위치별 원본 셀 (원본 외상매입금 F41 위 · F42 가운데 · F49 아래) */
const TOTAL_SOURCE: Record<TotalPart, string> = {
  top: "F41",
  middle: "F42",
  bottom: "F49",
  single: "F41",
};

const address = (row: number, col: number) =>
  `${String.fromCharCode(64 + col)}${row}`;

export function entryComparison(
  source: ExcelJS.Worksheet,
  out: ExcelJS.Workbook,
  sheet: EntrySheet,
): CompareRow[] {
  const layout = buildEntrySheetLayout(sheet);
  const cells = layout.rows.flatMap((r) =>
    r.cells.map((c) => ({ ...c, row: r.row })),
  );
  const first = (pred: (c: CellSpec<EntryRole> & { row: number }) => boolean) =>
    cells.find(pred);
  const target = (c: { row: number; col: number }) => ({
    sheet: sheet.sheetName,
    address: address(c.row, c.col),
  });

  const pairs: RolePair[] = [];
  for (const role of ["title", "header", "name", "amount", "note"] as const) {
    const c = first((x) => x.role === role);
    if (c) {
      pairs.push({
        label: `${role}`,
        source: ENTRY_ROLE_CELLS[role],
        target: target(c),
      });
    }
  }
  for (const part of ["top", "middle", "bottom", "single"] as const) {
    const c = first((x) => x.role === "total" && x.totalPart === part);
    if (c) {
      pairs.push({
        label: `total (${part})`,
        source: TOTAL_SOURCE[part],
        target: target(c),
        ...(part === "single"
          ? {
              intended: {
                border:
                  "1행 그룹 총액은 네 면 테두리 (원본에는 1행 그룹이 없음 — 채권·채무 다운로드와 같은 규칙)",
              },
            }
          : {}),
      });
    }
  }
  const memo = first((x) => x.role === "memo" && !x.warn && x.row > 2);
  if (memo) {
    pairs.push({
      label: "memo",
      source: ENTRY_ROLE_CELLS.memo,
      target: target(memo),
    });
  }
  const warn = first((x) => x.warn === true);
  if (warn) {
    pairs.push({
      label: `빨간 안내 (${String(warn.value).slice(0, 12)}…)`,
      source: ENTRY_ROLE_CELLS.memo,
      target: target(warn),
      intended: {
        font: "확정 안 됨·입력 없음 안내는 빨간 글씨 (색은 원본 장기미수 C3 그대로)",
      },
    });
  }

  const rows = compareRoles(source, out, pairs);
  const ws = out.getWorksheet(sheet.sheetName)!;
  if (warn) {
    rows.push({
      item: `빨간 글씨 색 (원본 C3 ↔ ${sheet.sheetName}!${address(warn.row, warn.col)})`,
      original: stable(source.getCell("C3").font.color),
      actual: stable(ws.getCell(warn.row, warn.col).font.color),
      result:
        stable(source.getCell("C3").font.color) ===
        stable(ws.getCell(warn.row, warn.col).font.color)
          ? "같음"
          : "의도하지 않은 차이",
    });
  }
  const dataRow = first((x) => x.role === "amount")!.row;
  rows.push(
    ...compareSheetBasics(source, ws, {
      dataRow,
      separatorRows: layout.rows
        .filter((r) => r.kind === "separator")
        .map((r) => r.row),
      intended: { print: PRINT_REASON, orientation: ORIENTATION_REASON },
    }),
  );
  return rows;
}
