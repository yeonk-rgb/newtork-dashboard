import { Suspense } from "react";

import { ServiceDashboardScreen } from "@/modules/service";

// 서비스팀 대시보드 — 상태는 주소(연도·분기·그래프 단위·기간별 현황·실적 표 탭)
export default function ServicePage({ searchParams }: PageProps<"/service">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}
    >
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: PageProps<"/service">["searchParams"];
}) {
  return <ServiceDashboardScreen searchParams={await searchParams} />;
}
