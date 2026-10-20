import { Suspense } from "react";

import { UploadScreen } from "@/modules/management";

// 엑셀 업로드 · 과거 데이터 이관 — 경영지원 열람 권한이면 미리보기까지, 저장은 관리자·대표·팀장
export default function UploadPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}
    >
      <UploadScreen />
    </Suspense>
  );
}
