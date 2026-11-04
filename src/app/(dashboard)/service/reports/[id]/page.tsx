import { Suspense } from "react";

import { ReportDetailScreen } from "@/modules/service";

// 출장보고서 상세 + 첨부
export default function Page({ params }: PageProps<"/service/reports/[id]">) {
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
  params: PageProps<"/service/reports/[id]">["params"];
}) {
  const { id } = await params;
  return <ReportDetailScreen id={id} />;
}
