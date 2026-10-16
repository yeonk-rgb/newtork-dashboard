import { Suspense } from "react";

import { EntryScreen } from "@/modules/management";

// 월간 실적 입력 (?month=2026-09, 없으면 지난달)
export default function EntryPage({
  searchParams,
}: PageProps<"/management/entry">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}
    >
      <EntryContent searchParams={searchParams} />
    </Suspense>
  );
}

async function EntryContent({
  searchParams,
}: {
  searchParams: PageProps<"/management/entry">["searchParams"];
}) {
  const { month } = await searchParams;
  return (
    <EntryScreen monthParam={typeof month === "string" ? month : undefined} />
  );
}
