import { Suspense } from "react";

import { LedgerImportScreen } from "@/modules/management";

// 경영지원 관리 엑셀 가져오기 (?month=2026-10) — 올리기·추가는 경영지원 edit, 덮어쓰기는 confirm
export default function LedgerImportPage({
  searchParams,
}: PageProps<"/management/ledger/import">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}
    >
      <LedgerImportContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LedgerImportContent({
  searchParams,
}: {
  searchParams: PageProps<"/management/ledger/import">["searchParams"];
}) {
  const { month } = await searchParams;
  return (
    <LedgerImportScreen month={typeof month === "string" ? month : undefined} />
  );
}
