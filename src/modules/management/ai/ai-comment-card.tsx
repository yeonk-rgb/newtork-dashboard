// AI 분석 코멘트 카드 (서버): 선택 기간 → 분석 대상 분기를 정하고 저장된 코멘트를 보여준다
// 메인(`/`)·경영지원 상세(`/management`) 상단 공용 — 기록은 (연도, 분기)로만 찾으므로 두 화면이 같은 기록을 본다
import "server-only";

import { Suspense } from "react";

import { getCurrentUser } from "@/shared/auth";
import type { TeamAiFacts } from "@/shared/contracts/team-ai";
import { periodLabel, type Period } from "@/shared/period/period";

import { getTodayKst, loadSummaryInput } from "../data/load-summary-input";
import { computeManagementSummary } from "../metrics/summary";
import type { ManagementSummary } from "../metrics/types";
import { AiCardFrame } from "./ai-card-frame";
import { AiCommentPanel } from "./ai-comment-panel";
import { loadAiCommentView } from "./load-comment";
import type { AiActionResult } from "./generate";
import { aiCardAccess, aiTargetQuarter, type QuarterPeriod } from "./rules";

const TITLE = "AI 분석 코멘트";

/** 생산·서비스 숫자를 넣는 방법 — app 계층(page)이 다른 팀 모듈 index 로 만들어 넘긴다 */
export type TeamAiHooks = {
  loadTeams: (quarter: QuarterPeriod) => Promise<TeamAiFacts>;
  generateAction: (raw: unknown) => Promise<AiActionResult>;
};

export async function AiCommentCard({
  period,
  summary,
  teams,
}: {
  period: Period;
  /** 선택 기간의 지표 (분기 보기면 그대로 재사용) */
  summary: ManagementSummary;
  teams: TeamAiHooks;
}) {
  const user = await getCurrentUser();
  if (!user || aiCardAccess(user) === "none") return null;

  const quarter = aiTargetQuarter(period, summary.confirmation.confirmedMonths);
  if (!quarter) {
    return (
      <AiCardFrame title={TITLE}>
        <p className="py-10 text-center text-sm text-muted-foreground">
          {periodLabel(period)}에 확정된 달이 없어 분석할 분기가 없습니다.
        </p>
      </AiCardFrame>
    );
  }

  // getTodayKst()(connection)를 DB 조회보다 먼저 — prerender 에러 방지
  const today = await getTodayKst();
  const quarterSummary =
    period.unit === "quarter"
      ? summary
      : computeManagementSummary(await loadSummaryInput(quarter, today));
  const view = await loadAiCommentView(
    user,
    quarter,
    quarterSummary,
    today,
    await teams.loadTeams(quarter),
  );

  const basisNote =
    period.unit === "quarter"
      ? null
      : period.unit === "month"
        ? `${periodLabel(period)}이 속한 분기의 분석입니다.`
        : `${periodLabel(period)} 중 확정된 달이 있는 마지막 분기의 분석입니다.`;

  return (
    <AiCommentPanel
      title={`${TITLE} · ${view.quarterLabel}`}
      view={view}
      basisNote={basisNote}
      generateAction={teams.generateAction}
    />
  );
}

export function AiCommentCardSkeleton() {
  return (
    <AiCardFrame title={TITLE}>
      <div className="flex-1 animate-pulse space-y-2 py-4" aria-hidden>
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
      <p className="sr-only">AI 분석 코멘트를 불러오는 중</p>
    </AiCardFrame>
  );
}

/** 페이지 상단에 넣는 AI 카드 (자체 Suspense — 카드가 늦게 와도 KPI 등은 먼저 보인다) */
export function AiCommentSection({
  summary,
  teams,
}: {
  summary: ManagementSummary;
  teams: TeamAiHooks;
}) {
  return (
    <Suspense fallback={<AiCommentCardSkeleton />}>
      <AiCommentCard period={summary.period} summary={summary} teams={teams} />
    </Suspense>
  );
}
