// 엑셀 업로드 검증 → 미리보기 + 저장 계획 (순수 함수: DB·화면 모름)
// - 행별 오류(빈 값·형식·범위·중복·미래 달)를 모으고, 오류가 하나라도 있으면 저장 불가
// - 합계 행은 저장하지 않고 "합계 행 제외"로 표시, 빈 행은 건너뜀
// - 같은 파일을 미리보기와 저장에서 각각 다시 읽어 같은 결과를 만든다 (저장 직전 재검증)
import type { Cell, SheetTable } from "@/shared/upload/read-table";
import type { YearMonth } from "@/shared/period/period";

import { monthState } from "../entry/rules";
import { MAX_DIGITS } from "../entry/money-input";
import {
  COLUMNS,
  detectSheet,
  KIND_COLUMNS,
  KIND_LABEL,
  MONTHLY_AMOUNT_KEYS,
  type ColumnKey,
  type HeaderMatch,
  type MonthlyAmountKey,
  type SheetKind,
} from "./columns";

export type RowStatus = "ok" | "error" | "total";

export type PreviewRow = {
  /** 엑셀 행 번호 (1부터) */
  rowNumber: number;
  /** 미리보기 열 순서대로 표시 문자열 (금액은 천 단위 쉼표) */
  cells: string[];
  status: RowStatus;
  /** 오류·안내 (예: "기존 확정 값 덮어씀") */
  messages: string[];
};

export type PreviewSheet = {
  fileName: string;
  sheetName: string;
  kind: SheetKind;
  kindLabel: string;
  columns: string[];
  rows: PreviewRow[];
  /** 저장할 행 수 */
  saveCount: number;
  errorCount: number;
  totalCount: number;
  /** 시트 단위 안내 (열 없음 → 0원, 연도 열 없음 → 기준 연도 등) */
  notes: string[];
};

export type UploadPreview = {
  fileErrors: { fileName: string; error: string }[];
  sheets: PreviewSheet[];
  errorCount: number;
  saveCount: number;
  canSave: boolean;
};

export type MonthlyValues = Record<MonthlyAmountKey, bigint>;

export type UploadPlan = {
  targets: { year: number; revenueTarget: bigint }[];
  months: (YearMonth & MonthlyValues)[];
  /** 이력용 시트별 결과 */
  sheets: {
    fileName: string;
    sheetName: string;
    kind: SheetKind;
    savedRows: number;
    excludedRows: number;
  }[];
};

export type ExistingData = {
  /** "2026-3" → 상태 */
  months: Map<string, "DRAFT" | "CONFIRMED">;
  targetYears: Set<number>;
};

export type ParseContext = {
  /** 실적 시트에 연도 열이 없을 때 쓸 연도 */
  baseYear: number;
  /** 한국 날짜 (UTC 자정) — 미래·이번 달 판단 */
  today: Date;
  existing: ExistingData;
};

export type FileTables = {
  fileName: string;
  result: { ok: true; sheets: SheetTable[] } | { ok: false; error: string };
};

const TOTAL_PATTERN = /합계|총계|소계|누계|총합|^계$|total|sum/i;
const monthKey = (y: number, m: number) => `${y}-${m}`;
const comma = (v: bigint) => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** 금액 셀 → 원 단위 정수. 빈칸·"-" 는 0원 */
export function parseAmount(
  cell: Cell,
  multiplier = 1,
): { ok: true; value: bigint } | { ok: false; error: string } {
  if (cell === null) return { ok: true, value: 0n };
  let n: number;
  if (typeof cell === "number") {
    n = cell;
  } else {
    const text = cell.replace(/[,\s원₩]/g, "");
    if (text === "" || text === "-") return { ok: true, value: 0n };
    if (/^\(.*\)$/.test(text) || text.startsWith("-")) {
      return { ok: false, error: "음수 금액" };
    }
    if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false, error: "숫자가 아님" };
    n = Number(text);
  }
  if (!Number.isFinite(n)) return { ok: false, error: "숫자가 아님" };
  if (n < 0) return { ok: false, error: "음수 금액" };
  const won = Math.round(n * multiplier * 100) / 100;
  if (!Number.isInteger(won)) return { ok: false, error: "원 단위 소수점" };
  if (!Number.isSafeInteger(won) || String(won).length > MAX_DIGITS) {
    return { ok: false, error: `${MAX_DIGITS}자리 초과` };
  }
  return { ok: true, value: BigInt(won) };
}

/** 연도 셀: 2026, "2026", "2026년" */
export function parseYear(cell: Cell): number | null {
  const m = String(cell ?? "")
    .trim()
    .match(/^(\d{4})\s*년?$/);
  if (!m) return null;
  const year = Number(m[1]);
  return year >= 2000 && year <= 2100 ? year : null;
}

/** 월 셀: 3, "3", "03", "3월", "2026-03", "2026.3", "2026년 3월", "2026-03-01" → 연도도 함께 */
export function parseMonth(
  cell: Cell,
): { year: number | null; month: number } | null {
  const text = String(cell ?? "").trim();
  let m = text.match(/^(\d{1,2})\s*월?$/);
  if (m) {
    const month = Number(m[1]);
    return month >= 1 && month <= 12 ? { year: null, month } : null;
  }
  m = text.match(/^(\d{4})\s*(?:년|[-./])\s*(\d{1,2})\s*월?(?:[-./]\d{1,2})?$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
    return { year, month };
  }
  return null;
}

const isEmptyRow = (row: Cell[]) => row.every((c) => c === null);

function cellsOf(row: Cell[], match: HeaderMatch, keys: ColumnKey[]) {
  return keys.map((k) => {
    const c = match.columns[k];
    return c === undefined ? null : (row[c] ?? null);
  });
}

/** 파일들 → 미리보기 + 저장 계획 */
export function parseUpload(
  files: FileTables[],
  ctx: ParseContext,
): { preview: UploadPreview; plan: UploadPlan } {
  const plan: UploadPlan = { targets: [], months: [], sheets: [] };
  const sheets: PreviewSheet[] = [];
  const fileErrors: UploadPreview["fileErrors"] = [];
  /** 업로드 안에서 같은 연도·달이 두 번 나오는지 */
  const seenTargets = new Map<number, string>();
  const seenMonths = new Map<string, string>();

  for (const file of files) {
    if (!file.result.ok) {
      fileErrors.push({ fileName: file.fileName, error: file.result.error });
      continue;
    }
    for (const table of file.result.sheets) {
      // 빈 시트는 표시하지 않는다
      if (table.rows.every(isEmptyRow)) continue;
      const match = detectSheet(table.rows, table.sheetName);
      const where = `${file.fileName} › ${table.sheetName}`;

      if (match.kind === "unknown") {
        sheets.push({
          fileName: file.fileName,
          sheetName: table.sheetName,
          kind: "unknown",
          kindLabel: KIND_LABEL.unknown,
          columns: [],
          rows: [],
          saveCount: 0,
          errorCount: 0,
          totalCount: 0,
          notes: [
            "연간목표·월별실적 열을 찾지 못해 저장하지 않습니다. (매출내역·미수금 시트는 다음 단계에서 지원)",
          ],
        });
        continue;
      }

      const keys = KIND_COLUMNS[match.kind];
      const notes: string[] = [];
      const missing = keys.filter((k) => match.columns[k] === undefined);
      if (match.kind === "monthly" && missing.includes("year")) {
        notes.push(
          `연도 열이 없어 기준 연도 ${ctx.baseYear}년으로 저장합니다.`,
        );
      }
      const missingAmounts = missing.filter(
        (k) => k !== "year" && k !== "month",
      );
      if (missingAmounts.length > 0) {
        notes.push(
          `${missingAmounts.map((k) => COLUMNS[k].label).join(", ")} 열이 없어 0원으로 저장합니다.`,
        );
      }
      const scaled = keys.filter((k) => (match.multipliers[k] ?? 1) !== 1);
      if (scaled.length > 0) {
        notes.push(
          `${scaled.map((k) => COLUMNS[k].label).join(", ")}: 머리글 단위(천원·백만원)를 원으로 환산했습니다.`,
        );
      }

      const rows: PreviewRow[] = [];
      let saveCount = 0;
      let excluded = 0;
      for (let r = match.headerRow + 1; r < table.rows.length; r += 1) {
        const raw = table.rows[r];
        if (isEmptyRow(raw)) continue;
        const cells = cellsOf(raw, match, keys);
        const rowNumber = r + 1;
        const messages: string[] = [];
        const keyCells =
          match.kind === "monthly" ? cells.slice(0, 2) : cells.slice(0, 1);
        if (keyCells.some((c) => c !== null && TOTAL_PATTERN.test(String(c)))) {
          rows.push({
            rowNumber,
            cells: cells.map((c) => (c === null ? "" : String(c))),
            status: "total",
            messages: ["합계 행 제외"],
          });
          excluded += 1;
          continue;
        }

        if (match.kind === "annualTarget") {
          const year = parseYear(cells[0]);
          const amount = parseAmount(cells[1], match.multipliers.revenueTarget);
          if (year === null)
            messages.push(
              cells[0] === null
                ? "연도가 비어 있습니다"
                : "연도 형식 오류 (예: 2026)",
            );
          if (!amount.ok) messages.push(`목표매출액: ${amount.error}`);
          else if (amount.value <= 0n)
            messages.push("목표매출액이 비어 있거나 0원입니다");
          if (year !== null) {
            const prev = seenTargets.get(year);
            if (prev) messages.push(`${year}년 목표가 이미 있습니다 (${prev})`);
            else seenTargets.set(year, `${where} ${rowNumber}행`);
            if (ctx.existing.targetYears.has(year))
              messages.push("기존 목표 덮어씀");
          }
          const ok =
            year !== null &&
            amount.ok &&
            amount.value > 0n &&
            !messages.some(isError);
          rows.push({
            rowNumber,
            cells: [
              year === null ? String(cells[0] ?? "") : String(year),
              amount.ok ? comma(amount.value) : String(cells[1] ?? ""),
            ],
            status: ok ? "ok" : "error",
            messages,
          });
          if (ok && amount.ok) {
            plan.targets.push({ year: year!, revenueTarget: amount.value });
            saveCount += 1;
          }
          continue;
        }

        // 월별실적
        const monthCell = parseMonth(cells[1]);
        const yearFromCol =
          match.columns.year === undefined ? null : parseYear(cells[0]);
        let year: number | null = null;
        if (match.columns.year !== undefined) {
          if (yearFromCol === null) {
            messages.push(
              cells[0] === null
                ? "연도가 비어 있습니다"
                : "연도 형식 오류 (예: 2026)",
            );
          }
          year = yearFromCol;
        } else {
          year = monthCell?.year ?? ctx.baseYear;
        }
        if (monthCell === null) {
          messages.push(
            cells[1] === null ? "월이 비어 있습니다" : "월 형식 오류 (1~12)",
          );
        } else if (
          monthCell.year !== null &&
          year !== null &&
          monthCell.year !== year
        ) {
          messages.push("연도와 월의 연도가 다릅니다");
        }
        const values = {} as MonthlyValues;
        const display: string[] = [];
        MONTHLY_AMOUNT_KEYS.forEach((k, i) => {
          const cell = cells[i + 2];
          const parsed = parseAmount(cell, match.multipliers[k]);
          if (parsed.ok) {
            values[k] = parsed.value;
            display.push(comma(parsed.value));
          } else {
            messages.push(`${COLUMNS[k].label}: ${parsed.error}`);
            display.push(String(cell ?? ""));
          }
        });
        if (year !== null && monthCell !== null) {
          const ym = { year, month: monthCell.month };
          const state = monthState(ym, ctx.today);
          if (state === "future") messages.push("미래 달은 올릴 수 없습니다");
          if (state === "current")
            messages.push("이번 달은 월이 끝난 뒤 올릴 수 있습니다");
          const key = monthKey(year, monthCell.month);
          const prev = seenMonths.get(key);
          if (prev)
            messages.push(
              `${year}년 ${monthCell.month}월이 이미 있습니다 (${prev})`,
            );
          else seenMonths.set(key, `${where} ${rowNumber}행`);
          const existing = ctx.existing.months.get(key);
          if (existing) {
            messages.push(
              existing === "CONFIRMED"
                ? "기존 확정 값 덮어씀"
                : "기존 임시저장 값 덮어씀(확정으로 저장)",
            );
          }
        }
        const ok =
          year !== null && monthCell !== null && !messages.some(isError);
        rows.push({
          rowNumber,
          cells: [
            year === null ? String(cells[0] ?? "") : String(year),
            monthCell ? String(monthCell.month) : String(cells[1] ?? ""),
            ...display,
          ],
          status: ok ? "ok" : "error",
          messages,
        });
        if (ok) {
          plan.months.push({ year: year!, month: monthCell!.month, ...values });
          saveCount += 1;
        }
      }

      const errorCount = rows.filter((r) => r.status === "error").length;
      sheets.push({
        fileName: file.fileName,
        sheetName: table.sheetName,
        kind: match.kind,
        kindLabel: KIND_LABEL[match.kind],
        columns: keys.map((k) => COLUMNS[k].label),
        rows,
        saveCount,
        errorCount,
        totalCount: excluded,
        notes,
      });
      plan.sheets.push({
        fileName: file.fileName,
        sheetName: table.sheetName,
        kind: match.kind,
        savedRows: saveCount,
        excludedRows: excluded,
      });
    }
  }

  const errorCount =
    fileErrors.length + sheets.reduce((n, s) => n + s.errorCount, 0);
  const saveCount = plan.targets.length + plan.months.length;
  return {
    preview: {
      fileErrors,
      sheets,
      errorCount,
      saveCount,
      canSave: errorCount === 0 && saveCount > 0,
    },
    plan,
  };
}

/** "덮어씀" 안내는 오류가 아니다 */
function isError(message: string): boolean {
  return !message.includes("덮어씀");
}
