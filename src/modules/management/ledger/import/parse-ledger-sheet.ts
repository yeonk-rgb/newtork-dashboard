// 경영지원_관리.xlsx(고객사 원본 양식) → 블록·행 (순수 함수, DB·화면 모름)
// 원본 구조 (2026-10-25 확인, __fixtures__/ledger-template.xlsx)
// - Sheet1 하나에 블록 4개가 세로로: C열 제목(외상매출금·외상매입금·미지급비용-직원·미지급비용-업체) → 다음 행이 헤더
// - 헤더: 코드(A, 외상매출금만·숨김 열) | 거래처명(C) | 잔액(D) | 적요(E) | 총액(F)
// - F열 총액은 그룹마다 세로 병합 + =SUM(D..:D..). 데이터로 저장하지 않고 검증에만 쓴다
// - 외상매출금 그룹 = F열 병합 범위, H열 메모("← 장기 미수금 업체" 등)로 상태 판별, 빨간 글씨 = 장기미수
// - 미지급비용-업체: 적요 "자동이체" 또는 연두 배경(테마 색) = 자동이체. 66행은 원본 SUM 범위 밖
// 행 번호는 고정이 아니라고 보고 제목 글자로 찾는다
import {
  columnLetter,
  getCell,
  type MergeRange,
  type SheetColor,
  type StyledCell,
  type StyledSheet,
} from "@/shared/upload/read-styled-sheet";

import {
  AR_STATUS_LABEL,
  KIND_LABEL,
  LEDGER_KINDS,
  type ArStatus,
  type LedgerKind,
} from "../labels";
import {
  isPartnerCode,
  normalizePartnerName,
  NOTE_MAX,
  PARTNER_CODE_LENGTH,
  PARTNER_NAME_MAX,
} from "../rules";

const COL = { code: 1, name: 3, amount: 4, note: 5, total: 6, memo: 8 };
const MAX_AMOUNT_DIGITS = 15;

export type TotalState =
  /** 원본 총액 = 그 범위 잔액 합계 */
  | "match"
  | "mismatch"
  /** 수식은 있는데 파일에 계산값이 없음 (<v> 없음 — 엑셀이 아닌 도구로 저장한 파일 등). 계산값 0 과는 다름 */
  | "noResult"
  /** 총액 칸이 비어 있음 (예: 장기미수 F3:F4) */
  | "noTotal";

export type TotalCheck = {
  /** "F5:F24" */
  range: string;
  fromRow: number;
  toRow: number;
  /** 범위 안 행들의 잔액 합계 (오류 행 제외) */
  rowsSum: bigint;
  /** 파일의 총액 (없으면 null) */
  fileTotal: bigint | null;
  formula: string | null;
  state: TotalState;
};

export type ParsedRow = {
  /** 엑셀 행 번호 */
  row: number;
  kind: LedgerKind;
  partnerCode: string | null;
  partnerName: string;
  /** 오류 행은 null */
  amount: bigint | null;
  /** 적요 원문 (날짜 칸이면 엑셀 표시 그대로 "10/15") */
  note: string | null;
  /** 외상매출금 상태 (null = 미분류 — 미리보기에서 골라야 함) */
  arStatus: ArStatus | null;
  /** 외상매출금 상태 근거 */
  arStatusSource: "memo" | "red" | null;
  /** 당월수금완료 완료일 후보 ("YYYY-MM-DD") */
  settledOn: string | null;
  /** 완료일 근거: 적요 날짜 / 기준월 말일(또는 오늘) */
  settledSource: "note" | "monthEnd" | null;
  /** 적요에 날짜가 있었지만 완료일로 쓰지 않은 이유 (예: "적요 날짜(10/15)가 기준월 밖이라 사용하지 않음") */
  noteDateIgnored: string | null;
  autoTransfer: boolean;
  /** 저장을 막는 오류 */
  errors: string[];
  /** 확인이 필요하지만 저장은 되는 안내 */
  warnings: string[];
};

export type SkippedRows = {
  /** 거래처명·잔액 둘 다 빈 행 중 코드만 있는 행 */
  codeOnly: number[];
  /** 잔액 0원 */
  zero: number[];
};

export type ParsedBlock = {
  kind: LedgerKind;
  titleRow: number;
  /** 데이터 첫 행~마지막 행 (헤더 다음 ~ 다음 제목 전) */
  firstRow: number;
  lastRow: number;
  rows: ParsedRow[];
  skipped: SkippedRows;
  totals: TotalCheck[];
};

export type ParsedLedgerSheet = {
  sheetName: string;
  /** 파일 전체를 못 쓰는 오류 (양식이 아님·헤더가 다름 등) */
  fatal: string[];
  blocks: ParsedBlock[];
};

export type ParseOptions = {
  year: number;
  month: number;
  /** "YYYY-MM-DD" (한국 날짜) */
  today: string;
};

// ---------- 셀 읽기 ----------

const squash = (s: string) => s.replace(/\s+/g, "");

function text(cell: StyledCell | undefined): string {
  const v = cell?.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return "";
  return String(v).trim();
}

const isBlank = (cell: StyledCell | undefined) =>
  cell === undefined ||
  cell.value === null ||
  (typeof cell.value === "string" && cell.value.trim() === "");

/** 빨간 글씨: FF0000 (테마 색은 판별하지 않음) */
export function isRed(color: SheetColor | undefined): boolean {
  return color?.argb?.slice(-6) === "FF0000";
}

/**
 * 연두(초록 계열) 배경: 원본은 테마 색 9번(강조 6 = 초록) + 밝게(tint 0.8).
 * 직접 지정 색이면 초록 성분이 빨강·파랑보다 큰 색 (노랑 FFFF00 은 제외)
 */
export function isGreenFill(color: SheetColor | undefined): boolean {
  if (!color) return false;
  if (color.theme !== undefined) return color.theme === 9;
  const hex = color.argb?.slice(-6);
  if (!hex || !/^[0-9A-F]{6}$/.test(hex)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return g > r && g > b;
}

/** 날짜 칸 → 엑셀 표시 형식대로 글자 ("m/d" → "10/5", "mm월 dd일" → "10월 05일") */
export function formatNoteDate(date: Date, numFmt: string | undefined): string {
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const fmt = numFmt ?? "";
  const pad = (n: number) => String(n).padStart(2, "0");
  if (fmt.includes("월")) {
    return fmt.includes("mm") ? `${pad(m)}월 ${pad(d)}일` : `${m}월 ${d}일`;
  }
  return `${m}/${d}`;
}

type AmountRead =
  | { kind: "ok"; amount: bigint }
  | { kind: "empty" }
  | { kind: "error"; message: string };

/** 잔액 칸 → 원 단위 정수 */
export function readAmount(cell: StyledCell | undefined): AmountRead {
  if (cell?.formula && !cell.hasResult) {
    return {
      kind: "error",
      message:
        "잔액이 수식인데 계산값이 저장돼 있지 않습니다. 엑셀에서 열어 저장한 뒤 올려 주세요.",
    };
  }
  const v = cell?.value;
  if (v === null || v === undefined) return { kind: "empty" };
  let n: number;
  if (typeof v === "number") {
    n = v;
  } else if (typeof v === "string") {
    const cleaned = v.replace(/[,\s원₩]/g, "");
    if (cleaned === "") return { kind: "empty" };
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
      return {
        kind: "error",
        message: `잔액이 숫자가 아닙니다 ("${v.trim()}").`,
      };
    }
    n = Number(cleaned);
  } else {
    return { kind: "error", message: "잔액이 숫자가 아닙니다." };
  }
  if (n < 0) {
    return {
      kind: "error",
      message:
        "음수 잔액입니다 (선수금·과입금인지 확인하세요). 음수는 가져올 수 없습니다.",
    };
  }
  if (!Number.isInteger(n)) {
    return {
      kind: "error",
      message: "잔액에 소수점이 있습니다. 원 단위 정수만 가져옵니다.",
    };
  }
  if (!Number.isSafeInteger(n) || String(n).length > MAX_AMOUNT_DIGITS) {
    return { kind: "error", message: "잔액이 15자리를 넘습니다." };
  }
  return { kind: "ok", amount: BigInt(n) };
}

type CodeRead = { code: string | null; error: string | null };

/** 거래처코드: 문자열은 그대로, 숫자로 저장돼 있으면 10자리로 0 채움 */
export function readPartnerCode(cell: StyledCell | undefined): CodeRead {
  const v = cell?.value;
  if (v === null || v === undefined || v === "")
    return { code: null, error: null };
  const raw =
    typeof v === "number" && Number.isInteger(v) && v >= 0
      ? String(v).padStart(PARTNER_CODE_LENGTH, "0")
      : typeof v === "string"
        ? v.trim()
        : String(v);
  if (raw === "") return { code: null, error: null };
  return isPartnerCode(raw)
    ? { code: raw, error: null }
    : { code: null, error: `거래처코드는 숫자 10자리여야 합니다 ("${raw}").` };
}

/** 그 달의 마지막 날 "YYYY-MM-DD" */
export function monthEnd(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** 완료일 기본값: min(기준월 말일, 오늘) */
export function defaultSettledOn(opts: ParseOptions): string {
  const end = monthEnd(opts.year, opts.month);
  return end < opts.today ? end : opts.today;
}

export type NoteDateCandidate =
  | { ok: true; value: string }
  | { ok: false; reason: "outsideMonth" | "future" };

/**
 * 적요 날짜 → 완료일 후보 (2026-10-25 결정)
 * - 연도는 기준년도로 본다 (적요는 "10/15"처럼 월/일만 적음)
 * - 기준월 밖의 날짜·오늘 이후 날짜는 쓰지 않는다
 */
export function noteDateCandidate(
  date: Date,
  opts: ParseOptions,
): NoteDateCandidate {
  if (date.getUTCMonth() + 1 !== opts.month) {
    return { ok: false, reason: "outsideMonth" };
  }
  const m = String(opts.month).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const value = `${opts.year}-${m}-${d}`;
  if (value > opts.today) return { ok: false, reason: "future" };
  return { ok: true, value };
}

const IGNORED_REASON: Record<
  Extract<NoteDateCandidate, { ok: false }>["reason"],
  string
> = {
  outsideMonth: "기준월 밖이라",
  future: "오늘 이후라",
};

// ---------- 블록 ----------

const TITLE_OF: Record<string, LedgerKind> = Object.fromEntries(
  LEDGER_KINDS.map((k) => [squash(KIND_LABEL[k]), k]),
);

const HEADERS: [col: number, label: string][] = [
  [COL.name, "거래처명"],
  [COL.amount, "잔액"],
  [COL.note, "적요"],
];

/** AR 상태 메모: H열 글자 → 상태 (공백·화살표 무시) */
export function statusFromMemo(memo: string): ArStatus | null {
  const s = squash(memo);
  if (s.includes("장기미수금")) return "LONG_OVERDUE";
  if (s.includes("수금된")) return "COLLECTED";
  if (s.includes("수금예정")) return "SCHEDULED";
  return null;
}

function findTitles(sheet: StyledSheet) {
  const found: { kind: LedgerKind; row: number }[] = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const kind = TITLE_OF[squash(text(getCell(sheet, r, COL.name)))];
    if (kind) found.push({ kind, row: r });
  }
  return found.sort((a, b) => a.row - b.row);
}

/** F열 세로 병합 범위 (블록 데이터 행 안에 있는 것만) */
function totalRanges(sheet: StyledSheet, firstRow: number, lastRow: number) {
  return sheet.merges
    .filter(
      (m) =>
        m.left === COL.total &&
        m.right === COL.total &&
        m.top >= firstRow &&
        m.bottom <= lastRow,
    )
    .sort((a, b) => a.top - b.top);
}

function memoOf(sheet: StyledSheet, range: MergeRange): string {
  const parts: string[] = [];
  for (let r = range.top; r <= range.bottom; r++) {
    const t = text(getCell(sheet, r, COL.memo));
    if (t) parts.push(t);
  }
  return parts.join(" ");
}

function parseBlock(
  sheet: StyledSheet,
  kind: LedgerKind,
  titleRow: number,
  lastRow: number,
  opts: ParseOptions,
  fatal: string[],
): ParsedBlock | null {
  const headerRow = titleRow + 1;
  const label = KIND_LABEL[kind];
  const wrong = HEADERS.filter(
    ([col, h]) => squash(text(getCell(sheet, headerRow, col))) !== h,
  );
  if (
    kind === "AR" &&
    squash(text(getCell(sheet, headerRow, COL.code))) !== "코드"
  ) {
    wrong.unshift([COL.code, "코드"]);
  }
  if (wrong.length > 0) {
    fatal.push(
      `${label}: ${headerRow}행 머리글이 양식과 다릅니다 (${wrong
        .map(([col, h]) => `${columnLetter(col)}열 "${h}"`)
        .join(", ")} 필요).`,
    );
    return null;
  }

  const firstRow = headerRow + 1;
  const groups = totalRanges(sheet, firstRow, lastRow);
  const groupOf = (row: number) =>
    groups.find((g) => row >= g.top && row <= g.bottom) ?? null;
  const groupStatus = new Map(
    groups.map((g) => [g, statusFromMemo(memoOf(sheet, g))]),
  );

  const rows: ParsedRow[] = [];
  const skipped: SkippedRows = { codeOnly: [], zero: [] };

  for (let r = firstRow; r <= lastRow; r++) {
    const nameCell = getCell(sheet, r, COL.name);
    const amountCell = getCell(sheet, r, COL.amount);
    const codeCell = kind === "AR" ? getCell(sheet, r, COL.code) : undefined;

    if (isBlank(nameCell) && isBlank(amountCell) && !amountCell?.formula) {
      if (!isBlank(codeCell)) skipped.codeOnly.push(r);
      continue;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    const partnerName = normalizePartnerName(text(nameCell));
    if (!partnerName) errors.push("거래처명이 없습니다.");
    else if (partnerName.length > PARTNER_NAME_MAX) {
      errors.push(`거래처명이 ${PARTNER_NAME_MAX}자를 넘습니다.`);
    }

    const amountRead = readAmount(amountCell);
    if (amountRead.kind === "ok" && amountRead.amount === 0n) {
      skipped.zero.push(r);
      continue;
    }
    if (amountRead.kind === "empty") errors.push("잔액이 없습니다.");
    if (amountRead.kind === "error") errors.push(amountRead.message);
    const amount = amountRead.kind === "ok" ? amountRead.amount : null;

    const code =
      kind === "AR" ? readPartnerCode(codeCell) : { code: null, error: null };
    if (code.error) errors.push(code.error);

    // 적요: 날짜 칸은 엑셀 표시 그대로 글자로 (원문 보존)
    const noteCell = getCell(sheet, r, COL.note);
    const noteDate = noteCell?.value instanceof Date ? noteCell.value : null;
    const note = noteDate
      ? formatNoteDate(noteDate, noteCell?.numFmt)
      : text(noteCell) || null;
    if (note && note.length > NOTE_MAX) {
      errors.push(`적요가 ${NOTE_MAX}자를 넘습니다.`);
    }

    let arStatus: ArStatus | null = null;
    let arStatusSource: ParsedRow["arStatusSource"] = null;
    let settledOn: string | null = null;
    let settledSource: ParsedRow["settledSource"] = null;
    let noteDateIgnored: string | null = null;
    if (kind === "AR") {
      const group = groupOf(r);
      const fromMemo = group ? (groupStatus.get(group) ?? null) : null;
      // 빨간 글씨 판별은 외상매출금에서만 (업체 블록 D77:E79 빨간 글씨는 의미 미확인 → 무시, 05-28번)
      const red = isRed(nameCell?.font) || isRed(amountCell?.font);
      if (red) {
        arStatus = "LONG_OVERDUE";
        arStatusSource = "red";
        if (fromMemo && fromMemo !== "LONG_OVERDUE") {
          warnings.push(
            `빨간 글씨라 장기미수로 분류했습니다 (원래 그룹: ${AR_STATUS_LABEL[fromMemo]}).`,
          );
        }
      } else if (fromMemo) {
        arStatus = fromMemo;
        arStatusSource = "memo";
      }
      if (arStatus === "COLLECTED") {
        const candidate = noteDate ? noteDateCandidate(noteDate, opts) : null;
        if (candidate?.ok) {
          settledOn = candidate.value;
          settledSource = "note";
        } else {
          settledOn = defaultSettledOn(opts);
          settledSource = "monthEnd";
          if (candidate) {
            noteDateIgnored = `적요 날짜(${note})가 ${IGNORED_REASON[candidate.reason]} 사용하지 않음`;
          }
        }
      }
    }

    const autoTransfer =
      kind === "ACCRUED_VENDOR" &&
      (squash(note ?? "").includes("자동이체") ||
        [COL.name, COL.amount, COL.note].some((c) =>
          isGreenFill(getCell(sheet, r, c)?.fill),
        ));

    rows.push({
      row: r,
      kind,
      partnerCode: code.code,
      partnerName,
      amount,
      note,
      arStatus,
      arStatusSource,
      settledOn,
      settledSource,
      noteDateIgnored,
      autoTransfer,
      errors,
      warnings,
    });
  }

  const totals: TotalCheck[] = groups.map((g) => {
    const master = getCell(sheet, g.top, COL.total);
    const rowsSum = rows
      .filter((x) => x.row >= g.top && x.row <= g.bottom)
      .reduce((sum, x) => sum + (x.amount ?? 0n), 0n);
    const v = master?.value;
    const fileTotal =
      typeof v === "number" && Number.isFinite(v)
        ? BigInt(Math.round(v))
        : null;
    const state: TotalState =
      fileTotal !== null
        ? fileTotal === rowsSum
          ? "match"
          : "mismatch"
        : master?.formula
          ? "noResult"
          : "noTotal";
    return {
      range: `F${g.top}:F${g.bottom}`,
      fromRow: g.top,
      toRow: g.bottom,
      rowsSum,
      fileTotal,
      formula: master?.formula ?? null,
      state,
    };
  });

  return { kind, titleRow, firstRow, lastRow, rows, skipped, totals };
}

/** 시트 하나를 읽는다. 블록 제목을 하나도 못 찾으면 fatal */
export function parseLedgerSheet(
  sheet: StyledSheet,
  opts: ParseOptions,
): ParsedLedgerSheet {
  const fatal: string[] = [];
  const titles = findTitles(sheet);

  for (const kind of LEDGER_KINDS) {
    const count = titles.filter((t) => t.kind === kind).length;
    if (count === 0) {
      fatal.push(`"${KIND_LABEL[kind]}" 블록 제목(C열)을 찾지 못했습니다.`);
    } else if (count > 1) {
      fatal.push(`"${KIND_LABEL[kind]}" 블록 제목이 ${count}번 있습니다.`);
    }
  }
  if (fatal.length > 0) return { sheetName: sheet.name, fatal, blocks: [] };

  const blocks: ParsedBlock[] = [];
  titles.forEach((t, i) => {
    const lastRow = (titles[i + 1]?.row ?? sheet.rowCount + 1) - 1;
    const block = parseBlock(sheet, t.kind, t.row, lastRow, opts, fatal);
    if (block) blocks.push(block);
  });
  // 화면 순서는 엑셀 블록 순서와 상관없이 구분 순서대로
  blocks.sort(
    (a, b) => LEDGER_KINDS.indexOf(a.kind) - LEDGER_KINDS.indexOf(b.kind),
  );
  return { sheetName: sheet.name, fatal, blocks };
}

/** 여러 시트 중 양식 시트 고르기: 블록 제목이 있는 첫 시트 */
export function pickLedgerSheet(sheets: StyledSheet[]): StyledSheet | null {
  return sheets.find((s) => findTitles(s).some((t) => t.kind === "AR")) ?? null;
}
