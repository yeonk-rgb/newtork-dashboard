// 로그인·비밀번호 변경 화면 공통 틀 (사이드바 없는 가운데 카드)
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
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-10">
      <section className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm font-bold tracking-tight text-header">
          NEWTORK <span className="font-normal opacity-80">경영 대시보드</span>
        </p>
        <h1 className="mt-3 text-lg font-semibold">{title}</h1>
        {description && (
          <div className="mt-1 text-sm text-muted-foreground">
            {description}
          </div>
        )}
        <div className="mt-5">{children}</div>
      </section>
    </main>
  );
}

export function AuthFormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-14 animate-pulse rounded-md bg-muted" />
      <div className="h-14 animate-pulse rounded-md bg-muted" />
      <div className="h-10 animate-pulse rounded-md bg-muted" />
    </div>
  );
}
