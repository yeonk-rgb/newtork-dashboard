import { Suspense } from "react";

import { PriceManageScreen } from "@/modules/service";

// 부품 가격 관리 — ?part=
export default function Page({ searchParams }: PageProps<"/service/prices">) {
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
  searchParams: PageProps<"/service/prices">["searchParams"];
}) {
  return <PriceManageScreen searchParams={await searchParams} />;
}
