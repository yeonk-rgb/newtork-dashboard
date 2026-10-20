// AI 분석 코멘트 카드 데이터 (서버 전용): 최신 코멘트 + 지금 데이터와 같은지(해시 비교)
// 화면을 열 때는 DB 만 읽고 AI 는 호출하지 않는다
import "server-only";

import type { AppUser } from "@/shared/auth";
import { loadUserNames } from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import { periodLabel } from "@/shared/period/period";

import type { ManagementSummary } from "../metrics/types";
import { buildAiInput } from "./build-input";
import { hashAiInput } from "./hash";
import { EXAMPLE_MODEL } from "./examples";
import { MOCK_MODEL } from "./mock-comment";
import { PROMPT_VERSION } from "./prompt";
import {
  aiAbilities,
  aiInputMonths,
  type AiAbilities,
  type QuarterPeriod,
} from "./rules";
import { readStoredComment, type AiCommentDisplay } from "./schemas";

export type AiCommentView = {
  year: number;
  quarter: QuarterPeriod["quarter"];
  quarterLabel: string;
  /** 가장 최근 저장된 코멘트 id — 내용을 읽지 못해도 동시 생성 확인에 쓴다 */
  latestId: string | null;
  latest: {
    id: string;
    /** 옛 형식(legacy)도 새 모양으로 바꿔 읽은 것 */
    result: AiCommentDisplay;
    /** "2026-10-19 14:13:35" (한국 시간) */
    createdAtLabel: string;
    createdBy: string;
    /** 생성 방식: ai = 실제 AI, mock = 개발용 모의 응답, example = 시드 예시 */
    method: AiCommentMethod;
  } | null;
  /**
   * 최신이 아닌 이유 (최신이면 null)
   * - prompt: 분석 기준(프롬프트·입력 형식)이 바뀌기 전에 저장된 코멘트
   * - data: 저장 후 데이터가 바뀜 (입력 해시가 다름)
   */
  staleReason: "prompt" | "data" | null;
  abilities: AiAbilities;
};

export type AiCommentMethod = "ai" | "mock" | "example";

export function methodOf(model: string): AiCommentMethod {
  if (model === MOCK_MODEL) return "mock";
  if (model === EXAMPLE_MODEL) return "example";
  return "ai";
}

/** UTC 로 저장된 시각 → 한국 시간 "2026-10-19 14:13:35" */
export const dateTimeLabel = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);

/** AI 입력에 쓰이는 달·그 해 목표 중 엑셀 업로드로 저장된 것이 있는지 (05-19 동의 전 분석 차단) */
export async function hasUploadedInput(
  quarter: QuarterPeriod,
): Promise<boolean> {
  const [months, target] = await Promise.all([
    prisma.monthlyFinance.count({
      where: {
        uploadId: { not: null },
        OR: aiInputMonths(quarter).map((m) => ({
          year: m.year,
          month: m.month,
        })),
      },
    }),
    prisma.annualTarget.count({
      where: { year: quarter.year, uploadId: { not: null } },
    }),
  ]);
  return months + target > 0;
}

export async function loadLatestAiComment(year: number, quarter: number) {
  return prisma.aiComment.findFirst({
    where: { year, quarter },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * @param summary 분석 대상 분기의 지표 (getManagementSummary(quarter))
 * @param today UTC 자정 (한국 날짜)
 */
export async function loadAiCommentView(
  user: AppUser,
  quarter: QuarterPeriod,
  summary: ManagementSummary,
  today: Date,
): Promise<AiCommentView> {
  const [row, uploaded] = await Promise.all([
    loadLatestAiComment(quarter.year, quarter.quarter),
    hasUploadedInput(quarter),
  ]);
  const display = row ? readStoredComment(row.result) : null;
  const nameOf = await loadUserNames([row?.createdById]);
  const currentHash = hashAiInput(buildAiInput(summary, quarter));

  return {
    year: quarter.year,
    quarter: quarter.quarter,
    quarterLabel: periodLabel(quarter),
    latestId: row?.id ?? null,
    latest:
      row && display
        ? {
            id: row.id,
            result: display,
            createdAtLabel: dateTimeLabel(row.createdAt),
            createdBy: nameOf(row.createdById),
            method: methodOf(row.model),
          }
        : null,
    staleReason: !row
      ? null
      : row.promptVersion !== PROMPT_VERSION
        ? "prompt"
        : row.inputHash !== currentHash
          ? "data"
          : null,
    abilities: aiAbilities(
      user,
      quarter,
      today,
      summary.confirmation.hasData,
      uploaded,
    ),
  };
}
