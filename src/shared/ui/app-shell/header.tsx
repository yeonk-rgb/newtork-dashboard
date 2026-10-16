import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";

// TODO(인증 구현 시): 사용자명은 세션에서, 로그아웃은 Better Auth signOut으로 연결
export function Header() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between bg-header px-4 text-header-foreground">
      <Link href="/" className="text-sm font-bold tracking-tight">
        NEWTORK <span className="font-normal opacity-80">경영 대시보드</span>
      </Link>
      <div className="flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1.5">
          <UserRound className="size-4" aria-hidden />
          사용자명
        </span>
        <button
          type="button"
          disabled
          title="인증 구현 후 사용 가능"
          className="flex items-center gap-1 rounded px-2 py-1 opacity-70"
        >
          <LogOut className="size-4" aria-hidden />
          로그아웃
        </button>
      </div>
    </header>
  );
}
