import { Suspense } from "react";

import { ReportFormScreen } from "@/modules/service";

// 출장보고서 입력 · ?from=pdf = PDF로 등록
export default function Page({
  searchParams,
}: PageProps<"/service/reports/new">) {
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
  searchParams: PageProps<"/service/reports/new">["searchParams"];
}) {
  const sp = await searchParams;
  return <ReportFormScreen fromPdf={sp.from === "pdf"} />;
}
