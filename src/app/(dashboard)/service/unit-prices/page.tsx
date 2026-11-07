import { Suspense } from "react";

import { PartsCompareScreen } from "@/modules/service";

// 단가 · 부품별 비교 — ?q=&category=&hidden=1&part=
export default function Page({
  searchParams,
}: PageProps<"/service/unit-prices">) {
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
  searchParams: PageProps<"/service/unit-prices">["searchParams"];
}) {
  return <PartsCompareScreen searchParams={await searchParams} />;
}
