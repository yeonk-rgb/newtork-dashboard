/** 차트 카드 틀: 제목 + (선택) 배지 + (선택) 오른쪽 동작 */
export function ChartCard({
  title,
  badge,
  action,
  children,
}: {
  title: string;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-card border bg-card p-5">
      <header className="mb-4 flex items-start justify-between gap-2">
        <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
          {title}
          {badge && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {badge}
            </span>
          )}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
