import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  AiArea,
  AiCommentSection,
  DashboardTop,
  DashboardTopSkeleton,
  getManagementSummary,
  getManagementTrend,
  MainDashboard,
  resolvePeriod,
} from "@/modules/management";
import {
  getProductionOverview,
  getSalesShareByIndustry,
  getSalesShareBySeries,
} from "@/modules/production";
import { getServiceOverview } from "@/modules/service";
import { can, getCurrentUser, homePathFor } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";

// 메인 = 전사 요약 (2026-10-25 담당자 요청 순서): KPI 4개 → 분기별 목표 달성 현황 → 추이 및 분석 → 팀별 현황(2026-11-03) → AI 분석
export default function MainPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<DashboardTopSkeleton />}>
      <MainContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MainContent({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const user = await getCurrentUser();
  if (!user) return <Forbidden user={null} />;
  // 메인(전사 요약)을 볼 수 없으면 403 대신 자기 팀 페이지로 이동
  if (!can(user, "view", "management")) redirect(homePathFor(user));

  const { period: param } = await searchParams;
  const period = await resolvePeriod(
    typeof param === "string" ? param : undefined,
  );
  // 생산·서비스 데이터는 각 팀 index.ts 공개 함수로 (메인을 보는 관리자·경영지원팀은 모든 팀 열람 권한이 있다)
  const [summary, trend, industry, series, production, service] =
    await Promise.all([
      getManagementSummary(period),
      getManagementTrend(period),
      getSalesShareByIndustry(period),
      getSalesShareBySeries(period),
      getProductionOverview(period),
      getServiceOverview(period),
    ]);

  return (
    <div className="space-y-6">
      <DashboardTop title="경영 대시보드" summary={summary} showKpis={false} />
      <MainDashboard
        summary={summary}
        trend={trend}
        teams={{ industry, series, production, service }}
      />
      <AiArea>
        <AiCommentSection summary={summary} />
      </AiArea>
    </div>
  );
}
