import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { accessiblePages, roleLabel, type AppUser } from "@/shared/auth";

/** 권한 없음 안내 + 이동 가능한 페이지 링크. user가 null이면 배포 접근 차단 안내 */
export function Forbidden({ user }: { user: AppUser | null }) {
  const pages = user ? accessiblePages(user) : [];

  return (
    <section className="mx-auto mt-16 max-w-md rounded-lg border bg-card p-6 text-center">
      <ShieldAlert className="mx-auto size-10 text-destructive" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold">접근 권한이 없습니다</h1>
      {user ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {user.name} ({roleLabel(user)}) 계정으로는 이 페이지를 볼 수 없습니다.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          로그인 기능이 준비되기 전에는 접근할 수 없습니다.
        </p>
      )}
      {pages.length > 0 && (
        <div className="mt-5">
          <p className="text-xs text-muted-foreground">이동할 수 있는 페이지</p>
          <ul className="mt-2 flex flex-wrap justify-center gap-2">
            {pages.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="inline-block rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/85"
                >
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
