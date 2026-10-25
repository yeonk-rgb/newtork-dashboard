// 대시보드 상단 공통: 제목 + 기간 선택 + 안내 배너 + KPI 카드 (메인·경영지원 상세 공용)
import "server-only";

import { lastCompletedQuarter, parsePeriodParam } from "@/shared/period/url";

import { getTodayKst } from "../data/load-summary-input";
import { loadYearRange } from "../data/queries";
import type { ManagementSummary } from "../metrics/types";
import { ConfirmationBanner } from "./confirmation-banner";
import { KpiCards } from "./kpi-cards";
import { PeriodSelector } from "./period-selector";
import { pageTitleClass } from "@/shared/ui/styles";

/** URL 값 → 기간. 없거나 잘못되면 "이미 끝난 분기 중 가장 최근 분기" */
export async function resolvePeriod(param: string | undefined) {
  return parsePeriodParam(param) ?? lastCompletedQuarter(await getTodayKst());
}

export async function DashboardTop({
  title,
  summary,
  aboveKpis,
  showKpis = true,
}: {
  title: string;
  summary: ManagementSummary;
  /** KPI 카드 위에 넣을 내용 (경영지원 상세의 AI 분석 카드) */
  aboveKpis?: React.ReactNode;
  /** 경영 대시보드는 이 KPI 카드 대신 새 KPI 4개(MainDashboard)를 쓴다 */
  showKpis?: boolean;
}) {
  const range = await loadYearRange((await getTodayKst()).getUTCFullYear());
  // URL로 범위 밖 연도를 골라도 드롭다운에 보이도록
  const years = [...new Set([...range, summary.period.year])].sort();

  return (
    <section className="space-y-6" aria-label="기간 요약">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className={pageTitleClass}>{title}</h1>
        <PeriodSelector period={summary.period} years={years} />
      </div>
      <ConfirmationBanner confirmation={summary.confirmation} />
      {aboveKpis}
      {showKpis && <KpiCards summary={summary} />}
    </section>
  );
}

export function DashboardTopSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-card bg-muted" />
        ))}
      </div>
    </div>
  );
}
