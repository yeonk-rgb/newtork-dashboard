import { Suspense } from "react";

import { SitesScreen } from "@/modules/service";

// 출장지 관리
export default function Page({ searchParams }: PageProps<"/service/sites">) {
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
  searchParams: PageProps<"/service/sites">["searchParams"];
}) {
  return <SitesScreen searchParams={await searchParams} />;
}
