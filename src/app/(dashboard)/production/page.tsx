import { Suspense } from "react";

import { ProductionDashboardScreen } from "@/modules/production";

// 생산팀 대시보드 — 연도·기간·그래프 단위·표 탭은 주소로 (친구 저장소 화면 그대로)
export default function ProductionPage({
  searchParams,
}: PageProps<"/production">) {
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
  searchParams: PageProps<"/production">["searchParams"];
}) {
  return <ProductionDashboardScreen searchParams={await searchParams} />;
}
