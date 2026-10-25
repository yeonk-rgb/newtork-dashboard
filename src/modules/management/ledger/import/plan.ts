// 엑셀 이관 미리보기·저장 계획 (순수 함수) — 서버가 파일을 다시 읽어 이 함수로 다시 검증한 뒤 저장한다
import {
  KIND_LABEL,
  LEDGER_KINDS,
  type ArStatus,
  type ExpenseType,
  type LedgerKind,
  type PurchaseType,
} from "../labels";
import { ledgerDateErrors } from "../rules";
import { ledgerFieldsSchema, type LedgerFields } from "../schemas";
import {
  defaultSettledOn,
  type ParsedLedgerSheet,
  type ParsedRow,
  type ParseOptions,
  type TotalState,
} from "./parse-ledger-sheet";

// ---------- 화면에 넘기는 미리보기 (금액은 정수 문자열) ----------

export type PreviewRow = Omit<ParsedRow, "amount"> & { amount: string | null };

export type PreviewTotal = {
  range: string;
  rowsSum: string;
  fileTotal: string | null;
  formula: string | null;
  state: TotalState;
};

export type PreviewBlock = {
  kind: LedgerKind;
  rows: PreviewRow[];
  /** 블록 전체 잔액 합계 (오류 행 제외) */
  sum: string;
  /** 미지급비용-업체: 자동이체 합계 */
  autoTransferSum: string;
  skippedCodeOnly: number[];
  skippedZero: number[];
  totals: PreviewTotal[];
};

export type LedgerPreview = {
  fileName: string;
  /** 미리보기 때 파일 — 가져오기 때 같은 파일인지 확인 */
  fileSha256: string;
  sheetName: string;
  year: number;
  month: number;
  fatal: string[];
  blocks: PreviewBlock[];
  /** 같은 기준년월에 이미 있는 행 (숨기지 않은 것) */
  existing: Record<LedgerKind, number>;
  existingTotal: number;
  /** 완료일이 없는 당월수금완료 행의 기본값 min(기준월 말일, 오늘) — 미분류를 수금완료로 고를 때도 */
  defaultSettledOn: string;
  /** 파일 안 양식 시트 이름 (여러 장이면 다른 시트로 바꿀 수 있게) */
  sheetCandidates: string[];
  /** 시트 이름과 기준년월이 다를 때 안내 */
  sheetNote: string | null;
};

const sumOf = (rows: { amount: bigint | null }[]) =>
  rows.reduce((s, r) => s + (r.amount ?? 0n), 0n);

export function toPreview(
  parsed: ParsedLedgerSheet,
  meta: {
    fileName: string;
    fileSha256: string;
    year: number;
    month: number;
    /** "YYYY-MM-DD" (한국 날짜) */
    today: string;
    existing: Record<LedgerKind, number>;
    sheetCandidates?: string[];
    sheetNote?: string | null;
  },
): LedgerPreview {
  return {
    fileName: meta.fileName,
    fileSha256: meta.fileSha256,
    sheetName: parsed.sheetName,
    year: meta.year,
    month: meta.month,
    fatal: parsed.fatal,
    blocks: parsed.blocks.map((b) => ({
      kind: b.kind,
      rows: b.rows.map((r) => ({ ...r, amount: r.amount?.toString() ?? null })),
      sum: sumOf(b.rows).toString(),
      autoTransferSum: sumOf(b.rows.filter((r) => r.autoTransfer)).toString(),
      skippedCodeOnly: b.skipped.codeOnly,
      skippedZero: b.skipped.zero,
      totals: b.totals.map((t) => ({
        range: t.range,
        rowsSum: t.rowsSum.toString(),
        fileTotal: t.fileTotal?.toString() ?? null,
        formula: t.formula,
        state: t.state,
      })),
    })),
    existing: meta.existing,
    defaultSettledOn: defaultSettledOn(meta),
    sheetCandidates: meta.sheetCandidates ?? [parsed.sheetName],
    sheetNote: meta.sheetNote ?? null,
    existingTotal: LEDGER_KINDS.reduce((n, k) => n + meta.existing[k], 0),
  };
}

// ---------- 사용자 선택 → 저장 계획 ----------

/** 미리보기에서 고른 값 (키 = 엑셀 행 번호) */
export type ImportChoices = {
  /** 미분류 외상매출금의 상태 */
  arStatus: Record<number, ArStatus>;
  purchaseType: Record<number, PurchaseType>;
  /** 없으면 "기타" */
  expenseType: Record<number, ExpenseType>;
  /** 당월수금완료 완료일 수정 */
  settledOn: Record<number, string>;
};

export const EMPTY_CHOICES: ImportChoices = {
  arStatus: {},
  purchaseType: {},
  expenseType: {},
  settledOn: {},
};

export type ImportMode = "overwrite" | "append";

export type Blocker = {
  /** empty = 가져올 행 없음(오류 아님), choice = 고를 값 남음, error = 파일 오류 */
  type: "empty" | "choice" | "error";
  kind?: LedgerKind;
  row?: number;
  message: string;
};

export type PlannedEntry = { row: number; fields: LedgerFields };

export type ImportPlan = {
  blockers: Blocker[];
  entries: PlannedEntry[];
  /** 구분별 저장 건수·합계 */
  summary: Record<LedgerKind, { count: number; sum: bigint }>;
};

/** 행 하나의 최종 상태 (미분류면 사용자가 고른 값) */
export function finalArStatus(
  row: Pick<ParsedRow, "row" | "arStatus">,
  choices: ImportChoices,
): ArStatus | null {
  return row.arStatus ?? choices.arStatus[row.row] ?? null;
}

/** 당월수금완료 행의 완료일: 사용자 수정 > 파일(적요 날짜·기본값) > 기본값 */
export function finalSettledOn(
  row: Pick<ParsedRow, "row" | "settledOn">,
  choices: ImportChoices,
  opts: ParseOptions,
): string {
  return choices.settledOn[row.row] ?? row.settledOn ?? defaultSettledOn(opts);
}

export function buildImportPlan(
  parsed: ParsedLedgerSheet,
  choices: ImportChoices,
  opts: ParseOptions & { mode: ImportMode | null; existingTotal: number },
): ImportPlan {
  const blockers: Blocker[] = parsed.fatal.map((message) => ({
    type: "error",
    message,
  }));
  const entries: PlannedEntry[] = [];
  const summary = Object.fromEntries(
    LEDGER_KINDS.map((k) => [k, { count: 0, sum: 0n }]),
  ) as ImportPlan["summary"];

  for (const block of parsed.blocks) {
    const label = KIND_LABEL[block.kind];
    for (const row of block.rows) {
      const at = { kind: block.kind, row: row.row };
      if (row.errors.length > 0 || row.amount === null) {
        for (const message of row.errors) {
          blockers.push({
            type: "error",
            ...at,
            message: `${label} ${row.row}행: ${message}`,
          });
        }
        continue;
      }

      const common = {
        partnerName: row.partnerName,
        amount: row.amount.toString(),
        note: row.note ?? "",
        dueOn: "",
      };
      let raw: unknown;
      if (block.kind === "AR") {
        const status = finalArStatus(row, choices);
        if (!status) {
          blockers.push({
            type: "choice",
            ...at,
            message: `${label} ${row.row}행 ${row.partnerName}: 상태(미분류)를 고르세요.`,
          });
          continue;
        }
        const settledOn =
          status === "COLLECTED" ? finalSettledOn(row, choices, opts) : "";
        const dateError = ledgerDateErrors(
          {
            kind: "AR",
            arStatus: status,
            dueOn: null,
            settledOn: settledOn || null,
          },
          opts.today,
        ).settledOn;
        if (dateError) {
          blockers.push({
            type: "choice",
            ...at,
            message: `${label} ${row.row}행 ${row.partnerName}: ${dateError}`,
          });
          continue;
        }
        raw = {
          kind: "AR",
          arStatus: status,
          partnerCode: row.partnerCode ?? "",
          settledOn,
          ...common,
        };
      } else if (block.kind === "AP") {
        const purchaseType = choices.purchaseType[row.row];
        if (!purchaseType) {
          blockers.push({
            type: "choice",
            ...at,
            message: `${label} ${row.row}행 ${row.partnerName}: 매입유형을 고르세요.`,
          });
          continue;
        }
        raw = { kind: "AP", purchaseType, settledOn: "", ...common };
      } else if (block.kind === "ACCRUED_VENDOR") {
        raw = {
          kind: "ACCRUED_VENDOR",
          expenseType: choices.expenseType[row.row] ?? "OTHER",
          autoTransfer: row.autoTransfer,
          settledOn: "",
          ...common,
        };
      } else {
        raw = { kind: "ACCRUED_STAFF", settledOn: "", ...common };
      }

      // 화면에서 직접 입력할 때와 같은 검증 (거래처명 길이·금액 범위 등)
      const parsedFields = ledgerFieldsSchema.safeParse(raw);
      if (!parsedFields.success) {
        blockers.push({
          type: "error",
          ...at,
          message: `${label} ${row.row}행: ${parsedFields.error.issues[0]?.message ?? "값을 확인하세요."}`,
        });
        continue;
      }
      entries.push({ row: row.row, fields: parsedFields.data });
      summary[block.kind].count += 1;
      summary[block.kind].sum += parsedFields.data.amount;
    }
  }

  const rowCount = parsed.blocks.reduce((n, b) => n + b.rows.length, 0);
  if (parsed.fatal.length === 0 && rowCount === 0) {
    blockers.push({
      type: "empty",
      message:
        "가져올 데이터가 없습니다. 빈 양식이거나 거래처명·잔액이 비어 있습니다.",
    });
  }
  if (opts.existingTotal > 0 && opts.mode === null) {
    blockers.push({
      type: "choice",
      message: `${opts.year}년 ${opts.month}월에 이미 ${opts.existingTotal}행이 있습니다. 덮어쓰기·추가 중에 고르세요.`,
    });
  }
  return { blockers, entries, summary };
}

export type PreviewTodo = {
  /** 저장을 막는 파일 오류 (행 오류 + 양식 오류) */
  errors: number;
  /** 상태를 골라야 하는 외상매출금 행 */
  unclassified: number;
  /** 매입유형을 골라야 하는 외상매입금 행 */
  missingPurchaseType: number;
  /** 같은 달 데이터가 있는데 덮어쓰기·추가를 안 고름 */
  needsMode: boolean;
  /** 가져올 행이 하나도 없음 */
  empty: boolean;
};

/** 미리보기 화면의 "남은 할 일" — [가져오기] 버튼 활성화용 (서버가 buildImportPlan 으로 다시 확인) */
export function previewTodo(
  preview: LedgerPreview,
  choices: ImportChoices,
  mode: ImportMode | null,
): PreviewTodo {
  const rows = preview.blocks.flatMap((b) => b.rows);
  const ok = rows.filter((r) => r.errors.length === 0);
  return {
    errors:
      preview.fatal.length + rows.filter((r) => r.errors.length > 0).length,
    unclassified: ok.filter(
      (r) => r.kind === "AR" && !finalArStatus(r, choices),
    ).length,
    missingPurchaseType: ok.filter(
      (r) => r.kind === "AP" && !choices.purchaseType[r.row],
    ).length,
    needsMode: preview.existingTotal > 0 && mode === null,
    empty: preview.fatal.length === 0 && rows.length === 0,
  };
}

export const isTodoDone = (t: PreviewTodo) =>
  t.errors === 0 &&
  t.unclassified === 0 &&
  t.missingPurchaseType === 0 &&
  !t.needsMode &&
  !t.empty;
