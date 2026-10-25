import { Suspense } from "react";

import { HistoryScreen } from "@/modules/management";

// 변경 이력 (?from=2026-10-01&to=2026-10-31&actor=&screen=&action=&q=&page=) — 관리자(대표) + 경영지원팀
export default function HistoryPage({
  searchParams,
}: PageProps<"/management/history">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}
    >
      <HistoryContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HistoryContent({
  searchParams,
}: {
  searchParams: PageProps<"/management/history">["searchParams"];
}) {
  return <HistoryScreen params={await searchParams} />;
}
