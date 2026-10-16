import { Suspense } from "react";

import { SettingsScreen } from "@/modules/management";

// 목표·항목 설정 (?year=2026 / ?tab=categories) — 팀장(confirm 권한)만
export default function TargetsPage({
  searchParams,
}: PageProps<"/management/targets">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}
    >
      <TargetsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TargetsContent({
  searchParams,
}: {
  searchParams: PageProps<"/management/targets">["searchParams"];
}) {
  const { tab, year } = await searchParams;
  return (
    <SettingsScreen
      tab={typeof tab === "string" ? tab : undefined}
      yearParam={typeof year === "string" ? year : undefined}
    />
  );
}
