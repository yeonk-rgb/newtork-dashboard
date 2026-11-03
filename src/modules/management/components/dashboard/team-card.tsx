// 메인 "팀별 현황" 카드 (생산·서비스) — 숫자는 표시 모델(productionCardModel·serviceCardModel)에서만
// 생산·서비스 화면은 아직 placeholder 라 바로가기 링크는 화면을 옮긴 뒤에 붙인다
import { cn } from "@/shared/lib/utils";
import { cardTitleClass, pillClass } from "@/shared/ui/styles";

import type { TeamCardModel } from "./model";

export function TeamCard({ card }: { card: TeamCardModel }) {
  return (
    <section className="flex flex-col rounded-card border bg-card p-6">
      <h3 className={cn(cardTitleClass, "flex flex-wrap items-center gap-2")}>
        {card.title}
        {card.badge && (
          <span className={cn(pillClass, "bg-muted text-muted-foreground")}>
            {card.badge}
          </span>
        )}
      </h3>
      <dl className="mt-4 grid grid-cols-3 gap-4">
        {card.stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-bold tracking-[-0.02em] tabular-nums">
              {stat.value}
            </dd>
            {stat.hint && (
              <dd className="mt-0.5 text-xs text-muted-foreground">
                {stat.hint}
              </dd>
            )}
          </div>
        ))}
      </dl>
      {card.note && (
        <p className="mt-4 text-xs text-muted-foreground">{card.note}</p>
      )}
    </section>
  );
}
