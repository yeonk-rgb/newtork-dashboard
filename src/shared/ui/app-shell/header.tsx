import Link from "next/link";
import { Suspense } from "react";
import { UserRound } from "lucide-react";

import {
  can,
  DEV_USERS,
  getCurrentUser,
  isDevSwitchEnabledNow,
  roleLabel,
} from "@/shared/auth";

import { DevUserSwitcher } from "./dev-user-switcher";

export function Header() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between bg-header px-4 text-header-foreground">
      <Link href="/" className="text-sm font-bold tracking-tight">
        NEWTORK <span className="font-normal opacity-80">경영 대시보드</span>
      </Link>
      {/* cacheComponents: 사용자 정보는 요청 시점에 읽으므로 Suspense 안에서 */}
      <Suspense fallback={<span className="text-sm opacity-70">…</span>}>
        <HeaderUser />
      </Suspense>
    </header>
  );
}

async function HeaderUser() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex items-center gap-3 text-sm">
      {/* 상단 메뉴: 경영지원 열람 권한이 있으면 엑셀 업로드 바로가기 (실제 차단은 페이지에서) */}
      {can(user, "view", "management") && (
        <Link
          href="/management/upload"
          className="rounded px-2 py-1 hover:bg-white/10"
        >
          엑셀 업로드
        </Link>
      )}
      <span className="flex items-center gap-1.5">
        <UserRound className="size-4" aria-hidden />
        {user.name}
        <span className="opacity-70">· {roleLabel(user)}</span>
      </span>
      {/* 개발 환경에서만 렌더링 — 배포 빌드에는 드롭다운 자체가 없다 */}
      {isDevSwitchEnabledNow() && (
        <DevUserSwitcher
          currentId={user.id}
          users={DEV_USERS.map(({ id, name }) => ({ id, name }))}
        />
      )}
    </div>
  );
}
