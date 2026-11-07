import { Suspense } from "react";

import { UnitPriceUploadsScreen } from "@/modules/service";

// 단가 · 업로드 이력 (변경 이력의 단가 업로드 요약)
export default function Page() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}
    >
      <UnitPriceUploadsScreen />
    </Suspense>
  );
}
