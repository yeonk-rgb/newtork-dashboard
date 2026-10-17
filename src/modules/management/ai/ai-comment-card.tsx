// 메인 하단 AI 분석 코멘트 카드 (서버): 선택 기간 → 분석 대상 분기를 정하고 저장된 코멘트를 보여준다
import "server-only";

import { getCurrentUser } from "@/shared/auth";
import { periodLabel, type Period } from "@/shared/period/period";

import { ChartCard } from "../components/donuts/chart-card";
import { getTodayKst, loadSummaryInput } from "../data/load-summary-input";
import { computeManagementSummary } from "../metrics/summary";
import type { ManagementSummary } from "../metrics/types";
import { AiCommentPanel } from "./ai-comment-panel";
import { loadAiCommentView } from "./load-comment";
import { aiTargetQuarter } from "./rules";

const TITLE = "AI 분석 코멘트";

export async function AiCommentCard({
  period,
  summary,
}: {
  period: Period;
  /** 선택 기간의 지표 (분기 보기면 그대로 재사용) */
  summary: ManagementSummary;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const quarter = aiTargetQuarter(period, summary.confirmation.confirmedMonths);
  if (!quarter) {
    return (
      <ChartCard title={TITLE}>
        <p className="py-10 text-center text-sm text-muted-foreground">
          {periodLabel(period)}에 확정된 달이 없어 분석할 분기가 없습니다.
        </p>
      </ChartCard>
    );
  }

  // getTodayKst()(connection)를 DB 조회보다 먼저 — prerender 에러 방지
  const today = await getTodayKst();
  const quarterSummary =
    period.unit === "quarter"
      ? summary
      : computeManagementSummary(await loadSummaryInput(quarter, today));
  const view = await loadAiCommentView(user, quarter, quarterSummary, today);

  const basisNote =
    period.unit === "quarter"
      ? null
      : period.unit === "month"
        ? `${periodLabel(period)}이 속한 분기의 분석입니다.`
        : `${periodLabel(period)} 중 확정된 달이 있는 마지막 분기의 분석입니다.`;

  return (
    <ChartCard title={`${TITLE} · ${view.quarterLabel}`}>
      <AiCommentPanel view={view} basisNote={basisNote} />
    </ChartCard>
  );
}

export function AiCommentCardSkeleton() {
  return (
    <ChartCard title={TITLE}>
      <div className="flex-1 animate-pulse space-y-2 py-4" aria-hidden>
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
      <p className="sr-only">AI 분석 코멘트를 불러오는 중</p>
    </ChartCard>
  );
}
