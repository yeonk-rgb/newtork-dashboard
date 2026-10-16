import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  DashboardTop,
  DashboardTopSkeleton,
  getManagementSummary,
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

  const { period } = await searchParams;
  const summary = await getManagementSummary(
    resolvePeriod(typeof period === "string" ? period : undefined),
  );

  return <DashboardTop title="경영 대시보드" summary={summary} />;
}
