import { Suspense } from "react";

import { getCurrentUser } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";

// 권한 없음 안내 — proxy.ts 가 권한 없는 경로를 이 화면으로 바꿔 보여준다 (주소는 그대로)
export default function ForbiddenPage() {
  return (
    <Suspense fallback={null}>
      <ForbiddenContent />
    </Suspense>
  );
}

async function ForbiddenContent() {
  return <Forbidden user={await getCurrentUser()} />;
}
