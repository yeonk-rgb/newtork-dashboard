// 로그인·비밀번호 변경 화면 공통 틀 (사이드바 없는 가운데 카드)
import { Logo } from "@/shared/ui/brand/logo";
import { labelClass, pageTitleClass } from "@/shared/ui/styles";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-10">
      <section className="w-full max-w-sm rounded-card border bg-card p-8">
        {/* 로고 48px: 카드 안쪽 여백 32px, 아래 글자까지 24px (로고 높이의 50%) */}
        <Logo size="lg" />
        <p className={`mt-6 ${labelClass}`}>경영 대시보드</p>
        <h1 className={`mt-1 ${pageTitleClass}`}>{title}</h1>
        {description && (
          <div className="mt-2 text-sm text-muted-foreground">
            {description}
          </div>
        )}
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}

export function AuthFormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
