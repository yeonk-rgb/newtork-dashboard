// 로그인·비밀번호 변경 화면 공통 틀 (사이드바 없는 가운데 카드)
import { LogoMark } from "@/shared/ui/app-shell/header";

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
        <p className="flex items-center gap-2.5 text-base font-bold tracking-tight">
          <LogoMark />
          <span>
            NEWTORK{" "}
            <span className="font-medium text-muted-foreground">
              경영 대시보드
            </span>
          </span>
        </p>
        <h1 className="mt-6 text-xl font-bold">{title}</h1>
        {description && (
          <div className="mt-1 text-sm text-muted-foreground">
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
      <div className="h-11 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
