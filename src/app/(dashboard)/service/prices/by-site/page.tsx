import { Suspense } from "react";

import { PriceBySiteScreen } from "@/modules/service";

// 출장지별 가격 조회 — ?site=
export default function Page({
  searchParams,
}: PageProps<"/service/prices/by-site">) {
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
  searchParams: PageProps<"/service/prices/by-site">["searchParams"];
}) {
  return <PriceBySiteScreen searchParams={await searchParams} />;
}
