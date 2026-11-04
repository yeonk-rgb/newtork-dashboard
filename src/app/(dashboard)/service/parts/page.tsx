import { Suspense } from "react";

import { PartsScreen } from "@/modules/service";

// 부품 목록
export default function Page({ searchParams }: PageProps<"/service/parts">) {
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
  searchParams: PageProps<"/service/parts">["searchParams"];
}) {
  return <PartsScreen searchParams={await searchParams} />;
}
