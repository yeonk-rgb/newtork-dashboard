import Link from "next/link";
import { Suspense } from "react";

import { getCurrentUser, roleLabel } from "@/shared/auth";

import { ProfileMenu } from "./profile-menu";

export function Header() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-header px-6 text-header-foreground">
      <Link href="/" className="flex items-center gap-2.5">
        <LogoMark />
        <span className="text-base font-bold tracking-tight">
          NEWTORK{" "}
          <span className="font-medium text-muted-foreground">
            경영 대시보드
          </span>
        </span>
      </Link>
      {/* cacheComponents: 사용자 정보는 요청 시점에 읽으므로 Suspense 안에서 */}
      <Suspense
        fallback={
          <span className="size-9 animate-pulse rounded-full bg-muted" />
        }
      >
        <HeaderUser />
      </Suspense>
    </header>
  );
}

/** 로고 자리: 브랜드 색 라운드 사각형 + N (공식 로고 수령 전 임시) */
export function LogoMark() {
  return (
    <span
      aria-hidden
      className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
    >
      N
    </span>
  );
}

async function HeaderUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <ProfileMenu name={user.name} role={roleLabel(user)} />;
}
