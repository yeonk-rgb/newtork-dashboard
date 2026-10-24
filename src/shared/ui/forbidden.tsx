import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { accessiblePages, roleLabel, type AppUser } from "@/shared/auth";
import { Logo } from "@/shared/ui/brand/logo";
import {
  buttonPrimaryClass,
  labelClass,
  pageTitleClass,
} from "@/shared/ui/styles";

/** 권한 없음 안내 + 이동 가능한 페이지 링크. user가 null이면 로그인 안내 */
export function Forbidden({ user }: { user: AppUser | null }) {
  const pages = user ? accessiblePages(user) : [];

  return (
    <section className="mx-auto mt-16 max-w-md rounded-card border bg-card p-8 text-center">
      {/* 로고 32px, 아래 아이콘까지 24px (로고 높이의 50% 이상) */}
      <Logo size="md" />
      <span className="mx-auto mt-8 flex size-10 items-center justify-center rounded-full bg-muted">
        <ShieldAlert className="size-5 text-muted-foreground" aria-hidden />
      </span>
      <h1 className={`mt-4 ${pageTitleClass}`}>접근 권한이 없습니다</h1>
      {user ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {user.name} ({roleLabel(user)}) 계정으로는 이 페이지를 볼 수 없습니다.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          로그인이 필요합니다.{" "}
          <Link
            href="/login"
            className="text-primary underline underline-offset-2"
          >
            로그인 화면으로
          </Link>
        </p>
      )}
      {user && pages.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          열람할 수 있는 페이지가 없습니다. 관리자에게 열람 범위를 요청하세요.
        </p>
      )}
      {pages.length > 0 && (
        <div className="mt-6">
          <p className={labelClass}>이동할 수 있는 페이지</p>
          <ul className="mt-2 flex flex-wrap justify-center gap-2">
            {pages.map((page) => (
              <li key={page.href}>
                <Link href={page.href} className={buttonPrimaryClass}>
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
