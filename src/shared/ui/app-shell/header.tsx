import Link from "next/link";
import { Suspense } from "react";
import { UserRound } from "lucide-react";

import {
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
