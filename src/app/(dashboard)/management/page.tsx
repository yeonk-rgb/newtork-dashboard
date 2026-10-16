import { Suspense } from "react";

import {
  DashboardTop,
  DashboardTopSkeleton,
  getManagementSummary,
  resolvePeriod,
} from "@/modules/management";
import { can, getCurrentUser } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";

// 경영지원 상세 (상세 표·차트는 이후 PR에서 추가)
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

  const { period } = await searchParams;
  const summary = await getManagementSummary(
    await resolvePeriod(typeof period === "string" ? period : undefined),
  );

  return <DashboardTop title="경영지원 상세" summary={summary} />;
}
