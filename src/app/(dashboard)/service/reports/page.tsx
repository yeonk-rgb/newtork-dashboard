import { Suspense } from "react";

import { ReportsScreen } from "@/modules/service";

// 출장보고서 목록 — 필터는 주소(GET), 50건씩
export default function Page({ searchParams }: PageProps<"/service/reports">) {
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
  searchParams: PageProps<"/service/reports">["searchParams"];
}) {
  return <ReportsScreen searchParams={await searchParams} />;
}
