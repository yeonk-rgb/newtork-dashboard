// AI 분석 코멘트 카드 데이터 (서버 전용): 최신 코멘트 + 지금 데이터와 같은지(해시 비교)
// 화면을 열 때는 DB 만 읽고 AI 는 호출하지 않는다
import "server-only";

import type { AppUser } from "@/shared/auth";
import { userDisplayName } from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import { periodLabel } from "@/shared/period/period";

import type { ManagementSummary } from "../metrics/types";
import { buildAiInput } from "./build-input";
import { hashAiInput } from "./hash";
import { MOCK_MODEL } from "./mock-comment";
import { aiAbilities, type AiAbilities, type QuarterPeriod } from "./rules";
import { aiCommentResultSchema, type AiCommentResult } from "./schemas";

export type AiCommentView = {
  year: number;
  quarter: QuarterPeriod["quarter"];
  quarterLabel: string;
  latest: {
    id: string;
    result: AiCommentResult;
    /** "2026-10-17 14:32" (한국 시간) */
    createdAtLabel: string;
    createdBy: string;
    isMock: boolean;
  } | null;
  /** 저장된 코멘트 이후 데이터가 바뀜 */
  isStale: boolean;
  abilities: AiAbilities;
};

const dateTimeLabel = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

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
  const row = await loadLatestAiComment(quarter.year, quarter.quarter);
  const parsed = row ? aiCommentResultSchema.safeParse(row.result) : null;
  const currentHash = hashAiInput(buildAiInput(summary, quarter));

  return {
    year: quarter.year,
    quarter: quarter.quarter,
    quarterLabel: periodLabel(quarter),
    latest:
      row && parsed?.success
        ? {
            id: row.id,
            result: parsed.data,
            createdAtLabel: dateTimeLabel(row.createdAt),
            createdBy: userDisplayName(row.createdById),
            isMock: row.model === MOCK_MODEL,
          }
        : null,
    isStale: row !== null && row.inputHash !== currentHash,
    abilities: aiAbilities(user, quarter, today, summary.confirmation.hasData),
  };
}
