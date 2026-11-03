import { Suspense } from "react";

import { DueCalendarScreen } from "@/modules/production";

// 납기 캘린더 — 상태는 주소(?year=&month=&date=&order=&find=)
export default function Page({
  searchParams,
}: PageProps<"/production/calendar">) {
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
  searchParams: PageProps<"/production/calendar">["searchParams"];
}) {
  return <DueCalendarScreen searchParams={await searchParams} />;
}
