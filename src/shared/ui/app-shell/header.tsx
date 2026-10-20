import Link from "next/link";
import { Suspense } from "react";
import { LogOut, UserRound } from "lucide-react";

import { logout } from "@/shared/auth/actions";
import { getCurrentUser, roleLabel } from "@/shared/auth";

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
      <Link
        href="/account/password"
        className="rounded px-1.5 py-0.5 opacity-90 hover:bg-white/15 hover:opacity-100"
      >
        비밀번호 변경
      </Link>
      <form action={logout}>
        <button
          type="submit"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 opacity-90 hover:bg-white/15 hover:opacity-100"
        >
          <LogOut className="size-3.5" aria-hidden />
          로그아웃
        </button>
      </form>
    </div>
  );
}
