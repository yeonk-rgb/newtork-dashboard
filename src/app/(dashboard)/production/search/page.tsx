import { Suspense } from "react";

import { SerialSearchScreen } from "@/modules/production";

// 일련번호 검색·제품 상세 — 상태는 주소(?serial=, ?id=)
export default function Page({
  searchParams,
}: PageProps<"/production/search">) {
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
  searchParams: PageProps<"/production/search">["searchParams"];
}) {
  return <SerialSearchScreen searchParams={await searchParams} />;
}
