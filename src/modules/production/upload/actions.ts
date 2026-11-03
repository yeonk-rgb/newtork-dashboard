"use server";
// 제조내역 엑셀 업로드 Server Action — 미리보기·저장 모두 서버에서 파일을 다시 읽고 판정한다 (화면 값은 믿지 않음)
import { refresh } from "next/cache";

import { getCurrentUser } from "@/shared/auth";
import { loadUserNames } from "@/shared/auth/user-names";
import { getNow } from "@/shared/time/now";
import { readTableFile } from "@/shared/upload/read-table";

import { NO_EDIT_MESSAGE, productionAbilities } from "../rules";
import { classify } from "./classify";
import { parseWorkbook, type ParsedSheet } from "./parse-sheet";
import { buildPreview, type UploadPreview } from "./preview";
import {
  fileHash,
  findUploadedBatch,
  loadExisting,
  saveUpload,
  UploadError,
} from "./save-upload";

/** 친구 저장소와 같은 한도 */
const MAX_BYTES = 5 * 1024 * 1024;

export type PreviewResult =
  { ok: true; preview: UploadPreview } | { ok: false; message: string };
export type SaveResult = { ok: boolean; message: string };

async function readFile(
  formData: FormData,
): Promise<
  | { ok: true; file: File; data: ArrayBuffer; sheets: ParsedSheet[] }
  | { ok: false; message: string }
> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "엑셀 파일을 선택하세요." };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, message: ".xlsx 형식의 엑셀 파일만 올릴 수 있습니다." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "파일이 너무 큽니다(최대 5MB)." };
  }
  const data = await file.arrayBuffer();
  const read = await readTableFile(file.name, data);
  if (!read.ok) return { ok: false, message: read.error };
  const parsed = parseWorkbook(read.sheets);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  return { ok: true, file, data, sheets: parsed.sheets };
}

export async function previewProductionUpload(
  formData: FormData,
): Promise<PreviewResult> {
  const user = await getCurrentUser();
  if (!productionAbilities(user).canEdit) {
    return { ok: false, message: NO_EDIT_MESSAGE };
  }
  const read = await readFile(formData);
  if (!read.ok) return read;
  const [existing, uploaded] = await Promise.all([
    loadExisting(read.sheets),
    findUploadedBatch(fileHash(read.data)),
  ]);
  const name = uploaded
    ? (await loadUserNames([uploaded.uploadedById]))(uploaded.uploadedById)
    : null;
  return {
    ok: true,
    preview: buildPreview(
      read.file.name,
      classify(read.sheets, existing),
      uploaded
        ? { uploadedAt: uploaded.uploadedAt.toISOString(), uploadedBy: name! }
        : null,
    ),
  };
}

export async function saveProductionUpload(
  formData: FormData,
): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user || !productionAbilities(user).canEdit) {
    return { ok: false, message: NO_EDIT_MESSAGE };
  }
  let overwriteKeys: string[];
  try {
    const raw: unknown = JSON.parse(String(formData.get("overwrite") ?? "[]"));
    if (!Array.isArray(raw) || !raw.every((k) => typeof k === "string")) {
      throw new Error();
    }
    overwriteKeys = raw;
  } catch {
    return { ok: false, message: "덮어쓸 행 목록 형식이 올바르지 않습니다." };
  }
  const read = await readFile(formData);
  if (!read.ok) return read;
  try {
    const saved = await saveUpload({
      fileName: read.file.name,
      hash: fileHash(read.data),
      sheets: read.sheets,
      overwriteKeys,
      user,
      now: await getNow(),
    });
    refresh();
    return {
      ok: true,
      message: `저장했습니다: 새로 저장 ${saved.created.toLocaleString("ko-KR")}행, 덮어씀 ${saved.overwritten.toLocaleString("ko-KR")}행`,
    };
  } catch (error) {
    if (error instanceof UploadError)
      return { ok: false, message: error.message };
    console.error("[production-upload] 저장 실패", error);
    return { ok: false, message: "저장하지 못했습니다. 다시 시도해 주세요." };
  }
}
