/** 차트 카드 틀: 제목 + (선택) 배지 + (선택) 오른쪽 동작 */
import { cardTitleClass, pillClass } from "@/shared/ui/styles";
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
    <section className="flex flex-col rounded-card border bg-card p-6">
      <header className="mb-4 flex items-start justify-between gap-2">
        <h2 className={`flex flex-wrap items-center gap-2 ${cardTitleClass}`}>
          {title}
          {badge && (
            <span className={`${pillClass} bg-muted text-muted-foreground`}>
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
