import { Suspense } from "react";

import { RecordsScreen } from "@/modules/production";

// 제조내역 — 필터는 주소(GET), 생산 열람 권한이면 수정·숨김까지
export default function ProductionRecordsPage({
  searchParams,
}: PageProps<"/production/records">) {
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
  searchParams: PageProps<"/production/records">["searchParams"];
}) {
  return <RecordsScreen searchParams={await searchParams} />;
}
