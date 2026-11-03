import { Suspense } from "react";

import { ReportFormScreen } from "@/modules/service";

// 출장보고서 수정
export default function Page({
  params,
}: PageProps<"/service/reports/[id]/edit">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}
    >
      <Content params={params} />
    </Suspense>
  );
}

async function Content({
  params,
}: {
  params: PageProps<"/service/reports/[id]/edit">["params"];
}) {
  const { id } = await params;
  return <ReportFormScreen id={id} />;
}
