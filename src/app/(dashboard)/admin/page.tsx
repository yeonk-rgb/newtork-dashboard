import { Suspense } from "react";

import { canAccessAdmin, getCurrentUser } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";
import { PlaceholderPage } from "@/shared/ui/placeholder-page";

// 관리자 페이지 기능(계정·권한 관리)은 통합 시 결정. 지금은 접근 제한만
export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user)) return <Forbidden user={user} />;

  return <PlaceholderPage title="관리자" />;
}
