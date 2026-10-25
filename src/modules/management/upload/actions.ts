"use server";
// 엑셀 업로드 Server Action — 미리보기·저장 모두 서버에서 파일을 다시 읽고 검증한다 (화면 값은 믿지 않음)
import { refresh } from "next/cache";

import { getCurrentUser } from "@/shared/auth";
import { readTableFile } from "@/shared/upload/read-table";

import { getNow, getTodayKst } from "../data/load-summary-input";
import {
  parseUpload,
  type FileTables,
  type UploadPreview,
} from "./parse-upload";
import { MAX_FILES, MAX_TOTAL_BYTES, uploadAbilities } from "./rules";
import { loadExistingData, saveUploadPlan } from "./save-upload";

export type PreviewResult =
  { ok: true; preview: UploadPreview } | { ok: false; message: string };

export type SaveResult =
  | { ok: true; message: string; savedRows: number }
  | { ok: false; message: string; preview?: UploadPreview };

type Parsed =
  | { ok: false; error: string }
  | ({ ok: true; files: File[] } & ReturnType<typeof parseUpload>);

/** 폼(파일·기준 연도) 확인 → 파일 읽기 → 검증 */
async function parse(formData: FormData): Promise<Parsed> {
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const baseYear = Number(formData.get("baseYear"));
  if (files.length === 0) return { ok: false, error: "파일을 선택해 주세요." };
  if (files.length > MAX_FILES) {
    return {
      ok: false,
      error: `한 번에 ${MAX_FILES}개 파일까지 올릴 수 있습니다.`,
    };
  }
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) {
    return { ok: false, error: "파일 크기 합계는 10MB 까지입니다." };
  }
  if (!Number.isInteger(baseYear) || baseYear < 2000 || baseYear > 2100) {
    return { ok: false, error: "기준 연도를 확인해 주세요." };
  }
  const tables: FileTables[] = await Promise.all(
    files.map(async (f) => ({
      fileName: f.name,
      result: await readTableFile(f.name, await f.arrayBuffer()),
    })),
  );
  const today = await getTodayKst();
  const existing = await loadExistingData();
  return {
    ok: true,
    files,
    ...parseUpload(tables, { baseYear, today, existing }),
  };
}

export async function previewUpload(
  formData: FormData,
): Promise<PreviewResult> {
  const user = await getCurrentUser();
  if (!user || !uploadAbilities(user).canView) {
    return { ok: false, message: "엑셀 업로드 화면을 볼 권한이 없습니다." };
  }
  const parsed = await parse(formData);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  return { ok: true, preview: parsed.preview };
}

export async function saveUpload(formData: FormData): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user || !uploadAbilities(user).canSave) {
    return {
      ok: false,
      message: "저장은 관리자·대표·경영지원 팀장만 할 수 있습니다.",
    };
  }
  const parsed = await parse(formData);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  // 미리보기 뒤 데이터가 바뀌었을 수 있으므로 저장 직전에 다시 검증
  if (!parsed.preview.canSave) {
    return {
      ok: false,
      message: "오류가 있는 행이 있어 아무것도 저장하지 않았습니다.",
      preview: parsed.preview,
    };
  }

  const { savedRows } = await saveUploadPlan(parsed.plan, {
    userId: user.id,
    loginId: user.loginId,
    fileNames: parsed.files.map((f) => f.name),
    now: await getNow(),
  });

  refresh(); // 대시보드·월간 입력·목표 화면이 새 값으로
  return {
    ok: true,
    savedRows,
    message: `${savedRows}행을 저장했습니다. 경영 대시보드에 바로 반영됩니다.`,
  };
}
