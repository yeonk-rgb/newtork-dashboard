import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getCurrentUser, homePathFor } from "@/shared/auth";
import { safeNextPath } from "@/shared/auth/login-rules";
import { AuthCard, AuthFormSkeleton } from "@/shared/ui/auth/auth-card";
import { LoginForm } from "@/shared/ui/auth/auth-forms";

// 로그인 (회원가입 없음 — 계정은 관리자가 발급)
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard
      title="로그인"
      description="관리자에게 받은 아이디와 비밀번호로 로그인하세요."
    >
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginContent({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { next } = await searchParams;
  const target = safeNextPath(typeof next === "string" ? next : null);

  // 이미 로그인했으면 바로 이동
  const user = await getCurrentUser();
  if (user) {
    redirect(
      user.mustChangePassword
        ? "/account/password"
        : (target ?? homePathFor(user)),
    );
  }
  return <LoginForm next={target} />;
}
