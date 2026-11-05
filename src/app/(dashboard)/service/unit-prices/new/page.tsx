import { Suspense } from "react";

import { NewPriceItemScreen } from "@/modules/service";

// 단가 · 부품 추가 (수기 입력 + 엑셀·CSV로 여러 개)
export default function Page() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}
    >
      <NewPriceItemScreen />
    </Suspense>
  );
}
