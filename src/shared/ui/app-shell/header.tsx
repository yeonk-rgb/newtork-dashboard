import Link from "next/link";
import { Suspense } from "react";

import { getCurrentUser, roleLabel } from "@/shared/auth";
import { Logo } from "@/shared/ui/brand/logo";

import { ProfileMenu } from "./profile-menu";

export function Header() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-header px-6 text-header-foreground">
      {/* 로고 32px: 헤더 높이 64px 라 위아래 여백 16px(= 로고 높이 50%), 옆 글자와도 16px */}
      <Link href="/" className="flex items-center gap-4">
        <Logo size="md" />
        <span className="text-base font-medium text-muted-foreground">
          경영 대시보드
        </span>
      </Link>
      {/* cacheComponents: 사용자 정보는 요청 시점에 읽으므로 Suspense 안에서 */}
      <Suspense
        fallback={
          <span className="h-10 w-40 animate-pulse rounded-full bg-muted" />
        }
      >
        <HeaderUser />
      </Suspense>
    </header>
  );
}

async function HeaderUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <ProfileMenu name={user.name} role={roleLabel(user)} />;
}
