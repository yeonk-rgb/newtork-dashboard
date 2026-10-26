import { Suspense } from "react";

import { ReceivablesScreen } from "@/modules/management";

// 미수금 건별 기록 (?tab=over90&q=거래처&hidden=1) — 경영지원 열람 권한이면 볼 수 있고, 동작은 권한별
export default function ReceivablesPage({
  searchParams,
}: PageProps<"/management/receivables">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}
    >
      <ReceivablesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReceivablesContent({
  searchParams,
}: {
  searchParams: PageProps<"/management/receivables">["searchParams"];
}) {
  const { tab, q, hidden } = await searchParams;
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  return (
    <ReceivablesScreen tab={str(tab)} query={str(q)} hidden={str(hidden)} />
  );
}
