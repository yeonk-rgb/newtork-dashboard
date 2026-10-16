import { redirect } from "next/navigation";
import { Suspense } from "react";

import { can, getCurrentUser, homePathFor } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";
import { PlaceholderPage } from "@/shared/ui/placeholder-page";

export default function MainPage() {
  return (
    <Suspense fallback={null}>
      <MainContent />
    </Suspense>
  );
}

async function MainContent() {
  const user = await getCurrentUser();
  if (!user) return <Forbidden user={null} />;
  // 메인(전사 요약)을 볼 수 없으면 403 대신 자기 팀 페이지로 이동
  if (!can(user, "view", "management")) redirect(homePathFor(user));

  return <PlaceholderPage title="메인 대시보드" />;
}
