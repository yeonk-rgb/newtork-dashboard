// 쌓기형 시트(목표 대비 실적·미수금 통계) ↔ 원본 양식 셀 단위 비교 목록 (테스트·npm run export:report 공용)
// 새 파일의 칸 위치는 배치(layout)에서 찾는다 — 행 번호를 고정하지 않음
import type ExcelJS from "exceljs";

import {
  compareRoles,
  compareSheetBasics,
  stable,
  type CompareRow,
  type RolePair,
} from "./compare";
import type { CellSpec, TotalPart } from "./draw";
import {
  STACKED_ROLE_CELLS,
  type StackedLayout,
  type StackedRole,
} from "./stacked";

const PRINT_REASON =
  "A4 너비 1페이지 맞춤·높이 자동 (2026-10-25 결정, 원본은 배율 100%)";
const ORIENTATION_REASON =
  "A4 가로 — 너비 맞춤 시 세로는 약 70%, 가로는 100% (월간 입력과 같은 기준, 2026-10-25)";

/** 총액 칸 위치별 원본 셀 — 일반: 외상매입금 F41 위·F42 가운데·F49 아래 / 빨간: 장기미수 F3 위·F4 아래 */
const TOTAL_SOURCE: Record<"total" | "warnTotal", Record<TotalPart, string>> = {
  total: { top: "F41", middle: "F42", bottom: "F49", single: "F41" },
  warnTotal: { top: "F3", middle: "F3", bottom: "F4", single: "F3" },
};

const address = (row: number, col: number) =>
  `${String.fromCharCode(64 + col)}${row}`;

export function stackedComparison(
  source: ExcelJS.Worksheet,
  out: ExcelJS.Workbook,
  sheetName: string,
  layout: StackedLayout,
): CompareRow[] {
  const cells = layout.rows.flatMap((r) =>
    r.cells.map((c) => ({ ...c, row: r.row })),
  );
  const first = (
    pred: (c: CellSpec<StackedRole> & { row: number }) => boolean,
  ) => cells.find(pred);
  const target = (c: { row: number; col: number }) => ({
    sheet: sheetName,
    address: address(c.row, c.col),
  });

  const pairs: RolePair[] = [];
  const plain: StackedRole[] = [
    "title",
    "header",
    "name",
    "amount",
    "note",
    "memo",
    "warnName",
    "warnAmount",
    "warnNote",
  ];
  for (const role of plain) {
    const c = first((x) => x.role === role && !x.warn);
    if (c) {
      pairs.push({
        label: role,
        source: STACKED_ROLE_CELLS[role as keyof typeof STACKED_ROLE_CELLS],
        target: target(c),
      });
    }
  }
  for (const role of ["total", "warnTotal"] as const) {
    for (const part of ["top", "middle", "bottom", "single"] as const) {
      const c = first(
        (x) => x.role === role && x.totalPart === part && !x.warn,
      );
      if (!c) continue;
      const noOriginal =
        part === "single" || (role === "warnTotal" && part === "middle");
      pairs.push({
        label: `${role} (${part})`,
        source: TOTAL_SOURCE[role][part],
        target: target(c),
        ...(noOriginal
          ? {
              intended: {
                border:
                  "원본에 없는 그룹 길이(1행 또는 3행 이상) — 위·가운데·아래 테두리 규칙 (채권·채무 다운로드와 같음)",
              },
            }
          : {}),
      });
    }
  }
  // 빨간 안내·빨간 총액 (색만 원본 장기미수 C3 빨강으로 바꿈)
  for (const role of ["memo", "note", "total", "auxLabel"] as const) {
    const c = first((x) => x.role === role && x.warn === true);
    if (!c) continue;
    const src =
      role === "total"
        ? TOTAL_SOURCE.total[c.totalPart ?? "top"]
        : STACKED_ROLE_CELLS[role];
    pairs.push({
      label: `${role} 빨간 글씨 (${String(c.value ?? "총액").slice(0, 12)})`,
      source: src,
      target: target(c),
      intended: {
        font: "주의할 숫자·안내는 빨간 글씨 (색은 원본 장기미수 C3 그대로)",
        ...(role === "total" && c.totalPart !== "top"
          ? { border: "그룹 길이에 맞춘 위·가운데·아래 테두리" }
          : {}),
      },
    });
  }
  const auxLabel = first((x) => x.role === "auxLabel" && !x.warn);
  if (auxLabel) {
    pairs.push({
      label: "auxLabel",
      source: STACKED_ROLE_CELLS.auxLabel,
      target: target(auxLabel),
    });
  }

  const rows = compareRoles(source, out, pairs);
  const ws = out.getWorksheet(sheetName)!;
  const warnCell = first((x) => x.warn === true);
  if (warnCell) {
    const o = stable(source.getCell("C3").font.color);
    const a = stable(ws.getCell(warnCell.row, warnCell.col).font.color);
    rows.push({
      item: `빨간 글씨 색 (원본 C3 ↔ ${sheetName}!${address(warnCell.row, warnCell.col)})`,
      original: o,
      actual: a,
      result: o === a ? "같음" : "의도하지 않은 차이",
    });
  }
  for (const role of ["auxAmount", "auxPercent"] as const) {
    const c = first((x) => x.role === role);
    if (!c) continue;
    rows.push({
      item: `${role} — I열 보조 칸 (${sheetName}!${address(c.row, c.col)})`,
      original: "(원본에 없는 칸)",
      actual: stable(ws.getCell(c.row, c.col).numFmt),
      result: "의도한 차이",
      reason:
        "H 라벨 + I 금액 — 채권·채무 다운로드 '자동이체 합계'와 같은 규칙 (총액 굵은 글꼴, 테두리 없음)",
    });
  }
  const dataRow = first(
    (x) => x.role === "amount" || x.role === "warnAmount",
  )!.row;
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
