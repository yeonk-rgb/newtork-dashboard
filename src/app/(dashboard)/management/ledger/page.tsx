import { Suspense } from "react";

import { LedgerScreen } from "@/modules/management";

// 경영지원 관리 (?month=2026-10&tab=ar&hidden=1) — 경영지원 열람 권한이면 볼 수 있고, 동작은 권한별
export default function LedgerPage({
  searchParams,
}: PageProps<"/management/ledger">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}
    >
      <LedgerContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LedgerContent({
  searchParams,
}: {
  searchParams: PageProps<"/management/ledger">["searchParams"];
}) {
  const { month, tab, hidden } = await searchParams;
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  return (
    <LedgerScreen month={str(month)} tab={str(tab)} hidden={str(hidden)} />
  );
}
