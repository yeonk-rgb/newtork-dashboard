import { Suspense } from "react";

import { ProductionUploadScreen } from "@/modules/production";

// 제조내역 엑셀 업로드 — 생산 열람 권한이면 입력까지 (생산팀 규칙)
export default function ProductionUploadPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}
    >
      <ProductionUploadScreen />
    </Suspense>
  );
}
