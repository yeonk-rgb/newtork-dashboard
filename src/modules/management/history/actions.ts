"use server";
// 행 [이력] 모달 — 경영지원 열람 권한이면 볼 수 있다 (숨긴 행도). 관리자 화면 기록은 섞이지 않는다
import { z } from "zod";

import { getCurrentUser } from "@/shared/auth";

import { loadRowHistory, type RowHistory } from "./load-history";
import { historyAbilities, ROW_HISTORY_TYPES } from "./rules";

const inputSchema = z.object({
  type: z.enum(ROW_HISTORY_TYPES),
  id: z.string().min(1).max(64),
});

export type RowHistoryResult =
  { ok: true; history: RowHistory } | { ok: false; message: string };

export async function getRowHistory(input: unknown): Promise<RowHistoryResult> {
  const user = await getCurrentUser();
  if (!user || !historyAbilities(user).canView) {
    return { ok: false, message: "권한이 없습니다." };
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "잘못된 요청입니다." };
  return {
    ok: true,
    history: await loadRowHistory(parsed.data.type, parsed.data.id),
  };
}
