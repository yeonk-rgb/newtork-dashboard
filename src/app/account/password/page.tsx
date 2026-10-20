import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { logout } from "@/shared/auth/actions";
import { getCurrentUser, homePathFor } from "@/shared/auth";
import { safeNextPath } from "@/shared/auth/login-rules";
import { AuthCard, AuthFormSkeleton } from "@/shared/ui/auth/auth-card";
import { ChangePasswordForm } from "@/shared/ui/auth/auth-forms";

// 비밀번호 변경 — 첫 로그인·초기화 후에는 proxy.ts 가 이 화면으로 보낸다 (바꾸기 전에는 다른 화면 불가)
export default function PasswordPage({
  searchParams,
}: PageProps<"/account/password">) {
  return (
    <Suspense
      fallback={
        <AuthCard title="비밀번호 변경">
          <AuthFormSkeleton />
        </AuthCard>
      }
    >
      <PasswordContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PasswordContent({
  searchParams,
}: {
  searchParams: PageProps<"/account/password">["searchParams"];
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/password");
  const { next } = await searchParams;
  const target = safeNextPath(typeof next === "string" ? next : null);

  return (
    <AuthCard
      title="비밀번호 변경"
      description={
        user.mustChangePassword ? (
          <p>
            {user.name}님, 초기 비밀번호를 사용 중입니다. 새 비밀번호로 바꾼 뒤
            이용할 수 있습니다.
          </p>
        ) : (
          <p>{user.name}님의 비밀번호를 바꿉니다.</p>
        )
      }
    >
      <ChangePasswordForm next={target} />
      <div className="mt-4 flex justify-between text-sm">
        {user.mustChangePassword ? (
          <span />
        ) : (
          <Link
            href={target ?? homePathFor(user)}
            className="text-muted-foreground hover:underline"
          >
            ← 돌아가기
          </Link>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="text-muted-foreground hover:underline"
          >
            로그아웃
          </button>
        </form>
      </div>
    </AuthCard>
  );
}
