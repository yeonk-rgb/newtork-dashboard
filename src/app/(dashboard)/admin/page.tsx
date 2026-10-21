import { Suspense } from "react";

import { AdminScreen } from "@/modules/admin";

// 관리자 설정 — 직원 역할·열람 범위·수정 권한, 비밀번호 초기화, 계정 추가·비활성화 (관리자만)
export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminScreen />
    </Suspense>
  );
}
