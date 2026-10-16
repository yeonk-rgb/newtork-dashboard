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
    <section className="flex flex-col rounded-lg border bg-card p-4 shadow-xs">
      <header className="mb-3 flex items-start justify-between gap-2">
        <h2 className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {title}
          {badge && (
            <span className="rounded border border-dashed border-muted-foreground/50 px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
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
