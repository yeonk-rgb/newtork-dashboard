import { Suspense } from "react";

import { CompaniesCompareScreen } from "@/modules/service";

// 단가 · 출장지별 비교 — ?category=&company=
export default function Page({
  searchParams,
}: PageProps<"/service/unit-prices/companies">) {
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
  searchParams: PageProps<"/service/unit-prices/companies">["searchParams"];
}) {
  return <CompaniesCompareScreen searchParams={await searchParams} />;
}
