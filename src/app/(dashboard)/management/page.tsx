import { Suspense } from "react";

import {
  AiCommentSection,
  DashboardTop,
  DashboardTopSkeleton,
  getManagementSummary,
  getManagementTrend,
  ManagementDetail,
  resolvePeriod,
} from "@/modules/management";
import { can, getCurrentUser } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";

// 경영지원 상세: 상단(기간·AI 분석·KPI) + 표·수치 위주 상세 (금액은 원 단위 전체)
export default function ManagementPage({
  searchParams,
}: PageProps<"/management">) {
  return (
    <Suspense fallback={<DashboardTopSkeleton />}>
      <ManagementContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ManagementContent({
  searchParams,
}: {
  searchParams: PageProps<"/management">["searchParams"];
}) {
  const user = await getCurrentUser();
  if (!user || !can(user, "view", "management")) {
    return <Forbidden user={user} />;
  }

  const { period: param } = await searchParams;
  const period = await resolvePeriod(
    typeof param === "string" ? param : undefined,
  );
  const [summary, trend] = await Promise.all([
    getManagementSummary(period),
    getManagementTrend(period),
  ]);

  return (
    <div className="space-y-6">
      <DashboardTop
        title="경영지원 상세"
        summary={summary}
        aboveKpis={<AiCommentSection summary={summary} />}
      />
      <ManagementDetail summary={summary} trend={trend} />
    </div>
  );
}
