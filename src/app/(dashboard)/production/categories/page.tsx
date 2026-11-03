import { Suspense } from "react";

import { CategoriesScreen } from "@/modules/production";

// 사업구분 지정 — 수주번호마다 산업 분야
export default function ProductionCategoriesPage({
  searchParams,
}: PageProps<"/production/categories">) {
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
  searchParams: PageProps<"/production/categories">["searchParams"];
}) {
  return <CategoriesScreen searchParams={await searchParams} />;
}
