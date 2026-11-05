import { Suspense } from "react";

import { UnitPriceUploadScreen } from "@/modules/service";

// 단가 · 단가 데이터 업로드 (CSV·엑셀 — 부품 단가표 / 출장지별 단가)
export default function Page() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}
    >
      <UnitPriceUploadScreen />
    </Suspense>
  );
}
