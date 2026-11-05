"use server";
// 단가 데이터 업로드 Server Action — 미리보기·저장 모두 서버에서 파일을 다시 읽고 판정한다 (화면 값은 믿지 않음)
// 권한: 서비스 edit (팀장 이상). 미리보기는 DB 쓰기 없음
import { refresh } from "next/cache";

import { getCurrentUser } from "@/shared/auth";
import { getNow } from "@/shared/time/now";
import { readTableFile } from "@/shared/upload/read-table";

import { NO_EDIT_MESSAGE, serviceAbilities } from "../rules";
import type { FieldDiff, Judged } from "./classify";
import {
  parseItemSheets,
  parseQuoteSheets,
  UPLOAD_KIND_LABEL,
  type ItemValues,
  type QuoteValues,
  type RowError,
  type UploadKind,
} from "./parse-upload";
import {
  judgeItems,
  judgeQuotes,
  saveUpload,
  UploadError,
  type Rows,
} from "./save-upload";

const MAX_BYTES = 5 * 1024 * 1024;
/** 미리보기에 보여 줄 최대 행 (요약 숫자는 전체) */
const PREVIEW_ROWS = 300;

export type PreviewLine = {
  row: number;
  partNo: string;
  /** 부품: 품목 · 적용 모델 / 단가: 출장지 · 적용 시작일 */
  detail: string;
  /** 부품: 기준값 / 단가: 단가 */
  price: number | null;
  diffs?: FieldDiff[];
};

export type UploadPreview = {
  kind: UploadKind;
  fileName: string;
  sheetName: string;
  original: boolean;
  summary: {
    created: number;
    changed: number;
    unchanged: number;
    hidden: number;
    skipped: number;
    errors: number;
  };
  created: PreviewLine[];
  changed: PreviewLine[];
  hidden: PreviewLine[];
  errors: RowError[];
};

export type PreviewResult =
  { ok: true; preview: UploadPreview } | { ok: false; message: string };

type Read =
  | {
      ok: true;
      kind: UploadKind;
      fileName: string;
      sheetName: string;
      original: boolean;
      skipped: number;
      rows: Rows<ItemValues> | Rows<QuoteValues>;
      errors: RowError[];
    }
  | { ok: false; message: string };

async function readUpload(formData: FormData): Promise<Read> {
  const kind = formData.get("kind");
  if (kind !== "items" && kind !== "quotes") {
    return { ok: false, message: "올릴 자료 종류를 고르세요." };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "CSV 또는 엑셀 파일을 선택하세요." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "파일이 너무 큽니다(최대 5MB)." };
  }
  const read = await readTableFile(file.name, await file.arrayBuffer());
  if (!read.ok) return { ok: false, message: read.error };
  const parsed =
    kind === "items"
      ? parseItemSheets(read.sheets)
      : parseQuoteSheets(read.sheets);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  return {
    ok: true,
    kind,
    fileName: file.name,
    sheetName: parsed.sheetName,
    original: parsed.original,
    skipped: parsed.skipped,
    rows: parsed.rows,
    errors: parsed.errors,
  };
}

function line(kind: UploadKind, r: { row: number; values: unknown }) {
  if (kind === "items") {
    const v = r.values as ItemValues;
    return {
      row: r.row,
      partNo: v.partNo,
      detail: [v.category, v.name, v.appliesTo].filter(Boolean).join(" · "),
      price: v.basePrice,
    };
  }
  const v = r.values as QuoteValues;
  return {
    row: r.row,
    partNo: v.partNo,
    detail: `${v.company} · ${v.effectiveDate}부터${v.note ? ` · ${v.note}` : ""}`,
    price: v.unitPrice,
  };
}

async function canEdit() {
  const user = await getCurrentUser();
  return user && serviceAbilities(user).canEdit ? user : null;
}

export async function previewUnitPriceUpload(
  formData: FormData,
): Promise<PreviewResult> {
  if (!(await canEdit())) return { ok: false, message: NO_EDIT_MESSAGE };
  const read = await readUpload(formData);
  if (!read.ok) return read;
  const j: Judged<unknown> =
    read.kind === "items"
      ? await judgeItems(read.rows as Rows<ItemValues>, read.errors)
      : await judgeQuotes(read.rows as Rows<QuoteValues>, read.errors);
  const lines = (rows: { row: number; values: unknown }[]) =>
    rows.slice(0, PREVIEW_ROWS).map((r) => line(read.kind, r));
  return {
    ok: true,
    preview: {
      kind: read.kind,
      fileName: read.fileName,
      sheetName: read.sheetName,
      original: read.original,
      summary: {
        created: j.created.length,
        changed: j.changed.length,
        unchanged: j.unchanged.length,
        hidden: j.hidden.length,
        skipped: read.skipped,
        errors: j.errors.length,
      },
      created: lines(j.created),
      changed: j.changed
        .slice(0, PREVIEW_ROWS)
        .map((r) => ({ ...line(read.kind, r), diffs: r.diffs })),
      hidden: lines(j.hidden),
      errors: j.errors.slice(0, PREVIEW_ROWS),
    },
  };
}

export async function saveUnitPriceUpload(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const user = await canEdit();
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const read = await readUpload(formData);
  if (!read.ok) return read;
  try {
    const saved = await saveUpload({
      kind: read.kind,
      fileName: read.fileName,
      rows: read.rows,
      parseErrors: read.errors,
      user,
      now: await getNow(),
    });
    refresh();
    return {
      ok: true,
      message: `${UPLOAD_KIND_LABEL[read.kind]}을(를) 저장했습니다: 새로 ${saved.created.toLocaleString("ko-KR")}행, 덮어씀 ${saved.overwritten.toLocaleString("ko-KR")}행`,
    };
  } catch (error) {
    if (error instanceof UploadError) {
      return { ok: false, message: error.message };
    }
    console.error("[unit-price-upload] 저장 실패", error);
    return { ok: false, message: "저장하지 못했습니다. 다시 시도해 주세요." };
  }
}
