"use server";
// 채권·채무 엑셀 이관 Server Action — 미리보기와 가져오기 모두 서버가 파일을 다시 읽어 검증한다
// 미리보기는 DB에 아무것도 쓰지 않는다
import { createHash } from "node:crypto";

import { refresh } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/shared/auth";
import { readStyledXlsx } from "@/shared/upload/read-styled-sheet";

import { getNow, getTodayKst } from "../../data/load-summary-input";
import {
  AR_STATUSES,
  EXPENSE_TYPES,
  LEDGER_KINDS,
  PURCHASE_TYPES,
  type LedgerKind,
} from "../labels";
import {
  formatLedgerMonth,
  isFutureMonth,
  parseLedgerMonth,
  toDateOnly,
} from "../rules";
import {
  parseLedgerSheet,
  selectLedgerSheet,
  type ParsedLedgerSheet,
} from "./parse-ledger-sheet";
import {
  buildImportPlan,
  toPreview,
  type Blocker,
  type ImportChoices,
  type LedgerPreview,
} from "./plan";
import { importAbilities, importFileError } from "./rules";
import {
  countExisting,
  ExistingChangedError,
  saveLedgerImport,
} from "./save-import";

type LoadError = {
  ok: false;
  error: string;
  /** 양식 시트가 여러 장인데 기준년월과 같은 이름이 없을 때 — 이 중에서 고르게 한다 */
  sheetChoices?: string[];
};

export type PreviewResult = { ok: true; preview: LedgerPreview } | LoadError;

export type ImportResult =
  | {
      ok: true;
      year: number;
      month: number;
      hidden: number;
      blocks: { kind: LedgerKind; count: number; sum: string }[];
    }
  | (LoadError & { blockers?: Blocker[] });

type Loaded = {
  userId: string;
  canOverwrite: boolean;
  year: number;
  month: number;
  today: string;
  fileName: string;
  fileSha256: string;
  parsed: ParsedLedgerSheet;
  sheetCandidates: string[];
  sheetNote: string | null;
  existing: Record<LedgerKind, number>;
};

/** 권한 → 기준년월 → 파일 검사 → 읽기 → 양식 해석 (미리보기·가져오기 공용) */
async function loadUpload(formData: FormData): Promise<Loaded | LoadError> {
  const user = await getCurrentUser();
  const abilities = user ? importAbilities(user) : null;
  if (!user || !abilities?.canImport) {
    return { ok: false, error: "엑셀을 가져올 권한이 없습니다. (열람만 가능)" };
  }

  const ym = parseLedgerMonth(String(formData.get("month") ?? ""));
  if (!ym) return { ok: false, error: "기준년월을 고르세요." };
  const today = toDateOnly(await getTodayKst());
  if (isFutureMonth(ym, today)) {
    return {
      ok: false,
      error: "이번 달 이후의 기준년월로는 가져올 수 없습니다.",
    };
  }

  const files = formData
    .getAll("file")
    .filter((f): f is File => f instanceof File);
  if (files.length !== 1) return { ok: false, error: "파일 1개를 고르세요." };
  const file = files[0];
  const fileError = importFileError(file);
  if (fileError) return { ok: false, error: fileError };

  const data = await file.arrayBuffer();
  const read = await readStyledXlsx(file.name, data);
  if (!read.ok) return { ok: false, error: read.error };
  const requested = String(formData.get("sheet") ?? "") || null;
  const selection = selectLedgerSheet(read.sheets, {
    month: formatLedgerMonth(ym),
    requested,
  });
  if (!selection.ok) {
    return selection.reason === "none"
      ? {
          ok: false,
          error:
            '경영지원_관리 양식이 아닙니다. C열에 "외상매출금" 같은 블록 제목이 있는 파일을 올려 주세요.',
        }
      : {
          ok: false,
          error: `이 파일에는 양식 시트가 여러 장 있고 기준년월(${formatLedgerMonth(ym)})과 같은 이름이 없습니다. 가져올 시트를 고르세요.`,
          sheetChoices: selection.candidates,
        };
  }
  const sheet = selection.sheet;

  return {
    userId: user.id,
    canOverwrite: abilities.canOverwrite,
    year: ym.year,
    month: ym.month,
    today,
    fileName: file.name,
    fileSha256: createHash("sha256").update(Buffer.from(data)).digest("hex"),
    parsed: parseLedgerSheet(sheet, { ...ym, today }),
    sheetCandidates: selection.candidates,
    sheetNote: selection.note,
    existing: await countExisting(ym.year, ym.month),
  };
}

export async function previewLedgerImport(
  formData: FormData,
): Promise<PreviewResult> {
  const loaded = await loadUpload(formData);
  if ("ok" in loaded) return loaded;
  return {
    ok: true,
    preview: toPreview(loaded.parsed, {
      fileName: loaded.fileName,
      fileSha256: loaded.fileSha256,
      year: loaded.year,
      month: loaded.month,
      today: loaded.today,
      existing: loaded.existing,
      sheetCandidates: loaded.sheetCandidates,
      sheetNote: loaded.sheetNote,
    }),
  };
}

const rowKey = z.string().regex(/^\d+$/);
const choicesSchema = z.object({
  arStatus: z.record(rowKey, z.enum(AR_STATUSES)),
  purchaseType: z.record(rowKey, z.enum(PURCHASE_TYPES)),
  expenseType: z.record(rowKey, z.enum(EXPENSE_TYPES)),
  settledOn: z.record(rowKey, z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

const importFormSchema = z.object({
  fileSha256: z.string().regex(/^[0-9a-f]{64}$/),
  mode: z.enum(["overwrite", "append", "none"]),
  expectedExisting: z.coerce.number().int().min(0),
  choices: z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "선택값 형식이 틀렸습니다." });
        return z.NEVER;
      }
    })
    .pipe(choicesSchema),
});

const toNumberKeys = <T>(record: Record<string, T>): Record<number, T> =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [Number(k), v]));

export async function importLedger(formData: FormData): Promise<ImportResult> {
  const loaded = await loadUpload(formData);
  if ("ok" in loaded) return loaded;

  const form = importFormSchema.safeParse({
    fileSha256: formData.get("fileSha256"),
    mode: formData.get("mode") ?? "none",
    expectedExisting: formData.get("expectedExisting"),
    choices: formData.get("choices"),
  });
  if (!form.success) {
    return {
      ok: false,
      error: "요청 값을 확인하세요. 다시 미리보기 해 주세요.",
    };
  }
  const { fileSha256, expectedExisting } = form.data;
  if (fileSha256 !== loaded.fileSha256) {
    return {
      ok: false,
      error: "미리보기한 파일과 다른 파일입니다. 다시 미리보기 해 주세요.",
    };
  }
  const existingTotal = LEDGER_KINDS.reduce(
    (n, k) => n + loaded.existing[k],
    0,
  );
  if (existingTotal !== expectedExisting) {
    return {
      ok: false,
      error:
        "미리보기 후 같은 기준년월 데이터가 바뀌었습니다. 다시 미리보기 해 주세요.",
    };
  }
  const mode = form.data.mode === "none" ? null : form.data.mode;
  if (mode === "overwrite" && !loaded.canOverwrite) {
    return {
      ok: false,
      error: "덮어쓰기는 팀장만 할 수 있습니다. [추가]를 고르세요.",
    };
  }
  // 기존 행이 없으면 덮어쓰기·추가 구분 없음
  const effectiveMode = existingTotal === 0 ? "append" : mode;

  const c = form.data.choices;
  const choices: ImportChoices = {
    arStatus: toNumberKeys(c.arStatus),
    purchaseType: toNumberKeys(c.purchaseType),
    expenseType: toNumberKeys(c.expenseType),
    settledOn: toNumberKeys(c.settledOn),
  };
  const plan = buildImportPlan(loaded.parsed, choices, {
    year: loaded.year,
    month: loaded.month,
    today: loaded.today,
    mode: effectiveMode,
    existingTotal,
  });
  if (plan.blockers.length > 0) {
    return {
      ok: false,
      error: plan.blockers[0].message,
      blockers: plan.blockers,
    };
  }

  const excludedRows = loaded.parsed.blocks.reduce(
    (n, b) => n + b.skipped.codeOnly.length + b.skipped.zero.length,
    0,
  );
  try {
    const saved = await saveLedgerImport({
      userId: loaded.userId,
      now: await getNow(),
      year: loaded.year,
      month: loaded.month,
      mode: effectiveMode ?? "append",
      expectedExisting,
      fileName: loaded.fileName,
      fileSha256,
      sheetName: loaded.parsed.sheetName,
      plan,
      excludedRows,
    });
    refresh();
    return {
      ok: true,
      year: loaded.year,
      month: loaded.month,
      hidden: saved.hidden,
      blocks: saved.blocks,
    };
  } catch (error) {
    if (error instanceof ExistingChangedError) {
      return { ok: false, error: `${error.message} 다시 미리보기 해 주세요.` };
    }
    console.error("[ledger-import] 저장 실패", error);
    return {
      ok: false,
      error:
        "저장하지 못했습니다. 중간에 실패해 전부 취소했으므로 아무것도 바뀌지 않았습니다. 잠시 후 다시 시도하세요.",
    };
  }
}
