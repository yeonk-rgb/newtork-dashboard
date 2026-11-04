import { Suspense } from "react";

import { PriceCompareScreen } from "@/modules/service";

// 출장지 비교 분석 — ?part=
export default function Page({
  searchParams,
}: PageProps<"/service/prices/compare">) {
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
  searchParams: PageProps<"/service/prices/compare">["searchParams"];
}) {
  return <PriceCompareScreen searchParams={await searchParams} />;
}
