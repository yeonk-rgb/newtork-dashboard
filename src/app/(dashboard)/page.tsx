import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  AiCommentSection,
  DashboardDonuts,
  DashboardTop,
  DashboardTopSkeleton,
  getManagementSummary,
  getManagementTrend,
  MainBottom,
  resolvePeriod,
} from "@/modules/management";
import { can, getCurrentUser, homePathFor } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";

// 메인 = 전사 요약
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
  const [summary, trend] = await Promise.all([
    getManagementSummary(period),
    getManagementTrend(period),
  ]);

  return (
    <div className="space-y-5">
      <DashboardTop title="경영 대시보드" summary={summary} showKpis={false} />
      <AiCommentSection summary={summary} />
      <DashboardDonuts summary={summary} />
      <MainBottom summary={summary} trend={trend} />
    </div>
  );
}
