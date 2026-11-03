// 경영 대시보드(메인) 새 구성 (2026-10-25 담당자 요청 순서)
// ① 상단 KPI 4개 → ② 분기별 목표 달성 현황 → ③ 추이 및 분석 → ④ 팀별 현황(생산·서비스, 2026-11-03) → (⑤ AI 분석은 page.tsx 맨 아래)
// 숫자는 표시 모델(model.ts)에서만 — 이 파일은 배치만 한다. 빠진 카드(연간 목표·BEP·이익 구조·미수금 원형)는 상세로 옮김
import "server-only";

import { ChevronDown } from "lucide-react";
import Link from "next/link";

import {
  INDUSTRIES,
  OTHER_SERIES_KEY,
  type ProductionOverview,
  type SalesShareResult,
} from "@/shared/contracts/production";
import type { ServiceOverview } from "@/shared/contracts/service";
import { serializeBigInt } from "@/shared/format/bigint";
import { formatWonShort } from "@/shared/format/money";
import { cn } from "@/shared/lib/utils";
import { periodMonths } from "@/shared/period/period";
import { toPeriodParam } from "@/shared/period/url";
import {
  INDUSTRY_COLORS,
  METER_ON_ACCENT,
  seriesColors,
} from "@/shared/ui/chart-colors";
import { DonutCard } from "@/shared/ui/donut-card";
import { pillClass, sectionTitleClass } from "@/shared/ui/styles";

import { getTodayKst } from "../../data/load-summary-input";
import type { TrendPoint } from "../../metrics/trend";
import type { ManagementSummary } from "../../metrics/types";
import { FlowChart } from "../bottom/flow-chart";
import { DASHBOARD_LABELS as L } from "./labels";
import { MainKpis } from "./main-kpis";
import {
  expenseMixDonut,
  productionCardModel,
  revenueMixDonut,
  serviceCardModel,
  shareDonutModel,
  targetCardModel,
  type TargetCardModel,
} from "./model";
import { TeamCard } from "./team-card";

/** 다른 팀 데이터 — page.tsx 가 각 팀 모듈 index.ts 공개 함수로 가져와 넘긴다 (모듈끼리 import 금지) */
export type TeamData = {
  industry: SalesShareResult;
  series: SalesShareResult;
  production: ProductionOverview;
  service: ServiceOverview;
};

const pct = (v: number | null) =>
  v === null ? "-" : `${(v * 100).toFixed(1)}%`;

/** 목표매출 달성률 카드 아래 (강조 카드 — 흰 글씨. 빨간 글씨는 코퍼 바탕에서 읽히지 않아 "▼ 미달" 배지로) */
function TargetFooter({ card }: { card: TargetCardModel }) {
  return (
    <>
      {card.summaryLine && <p>{card.summaryLine}</p>}
      {card.note && <p className="mt-1">{card.note}</p>}
      {card.quarterProgress && (
        <p className="mt-1 font-semibold">
          {card.quarterProgress.label} {pct(card.quarterProgress.rate)}
        </p>
      )}
      {card.quarters.length > 0 && (
        <ul className="mt-3 space-y-1" aria-label="분기별 목표 달성">
          {card.quarters.map((q) => (
            <li
              key={q.quarter}
              className={cn(
                "flex items-center justify-between gap-2",
                q.selected && "font-semibold",
              )}
            >
              <span>
                {q.quarter}분기
                {q.source === "allocated" && (
                  <span className="ml-1 font-normal">(자동 배분)</span>
                )}
              </span>
              <span className="flex items-center gap-2 tabular-nums">
                {q.state === "future" ? (
                  "-"
                ) : q.noConfirmedText ? (
                  // 확정된 달이 없으면 0.0% 대신 사실만 (엑셀과 같은 문장)
                  q.noConfirmedText
                ) : (
                  <>
                    {formatWonShort(q.actual)} / {formatWonShort(q.target)} ·{" "}
                    {pct(q.rate)}
                  </>
                )}
                {q.state === "current" && (
                  <span className={cn(pillClass, "bg-black/15 text-white")}>
                    진행 중
                  </span>
                )}
                {q.unconfirmedMonths.length > 0 && !q.noConfirmedText && (
                  <span className={cn(pillClass, "bg-black/15 text-white")}>
                    {q.unconfirmedMonths.join("·")}월 미확정
                  </span>
                )}
                {q.warn && (
                  <span className={cn(pillClass, "bg-black/15 text-white")}>
                    ▼ 미달
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {card.annual && (
        <p className="mt-3">
          연간 {pct(card.annual.rate)} · 경과율 {pct(card.annual.elapsedRatio)}{" "}
          ·{" "}
          <span className="font-semibold">
            진도 대비{" "}
            {card.annual.gap > 0 ? "▲" : card.annual.gap < 0 ? "▼" : ""}
            {Math.abs(card.annual.gap * 100).toFixed(1)}%p
            {card.annual.gap > 0
              ? " 앞섬"
              : card.annual.gap < 0
                ? " 뒤처짐"
                : ""}
          </span>
        </p>
      )}
    </>
  );
}

function Area({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className={sectionTitleClass}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export async function MainDashboard({
  summary,
  trend,
  teams,
}: {
  summary: ManagementSummary;
  trend: TrendPoint[];
  teams: TeamData;
}) {
  const { period } = summary;
  const today = await getTodayKst();
  const industry = shareDonutModel(
    "industry",
    teams.industry,
    INDUSTRIES.map((i) => i.key),
    INDUSTRY_COLORS,
  );
  const seriesPalette = seriesColors(
    teams.series.items.map((i) => i.key),
    OTHER_SERIES_KEY,
  );
  const series = shareDonutModel(
    "series",
    teams.series,
    seriesPalette.order,
    seriesPalette.colors,
  );
  const target = targetCardModel(summary, today, METER_ON_ACCENT);
  const revenue = revenueMixDonut(summary);
  const expense = expenseMixDonut(summary);
  const csv = (name: string) => `${name}_${toPeriodParam(period)}`;

  return (
    <>
      {/* ① 상단 KPI 4개 */}
      <MainKpis summary={summary} />

      {/* ② 분기별 목표 달성 현황 */}
      <Area id="area-status" title={L.areas.status}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <DonutCard
            title={target.title}
            tone="accent"
            layout="stacked"
            {...target.donut}
            csvName={csv("목표달성")}
            action={
              target.donut.emptyText ? (
                <Link
                  href="/management/targets"
                  className="shrink-0 text-xs text-white underline"
                >
                  목표 설정 →
                </Link>
              ) : undefined
            }
            footer={<TargetFooter card={target} />}
          />
          <DonutCard
            title={L.revenueMix}
            layout="stacked"
            {...revenue}
            csvName={csv("매출구성")}
          />
          <DonutCard
            title={L.expenseMix}
            layout="stacked"
            {...expense.donut}
            slices={expense.donut.slices.map((slice) => ({
              ...slice,
              hint: expense.sliceHints[slice.key],
            }))}
            csvName={csv("지출구성")}
            footer={
              expense.otherItems.length > 0 && (
                <details>
                  <summary className="cursor-pointer list-none text-primary [&::-webkit-details-marker]:hidden">
                    {L.otherExpenseToggle}
                    <ChevronDown
                      className="ml-0.5 inline size-3.5 align-[-2px]"
                      aria-hidden
                    />
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {expense.otherItems.map((item) => (
                      <li
                        key={item.key}
                        className="flex justify-between gap-2 tabular-nums"
                      >
                        <span>{item.label}</span>
                        <span className="text-foreground">
                          {formatWonShort(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )
            }
          />
        </div>
      </Area>

      {/* ③ 추이 및 분석 */}
      <Area id="area-trend" title={L.areas.trend}>
        <FlowChart
          titlePrefix={L.trendChart}
          highlight={periodMonths(period)}
          points={serializeBigInt(
            trend.map(
              ({ year, month, status, revenue, expense, profit, margin }) => ({
                year,
                month,
                status,
                revenue,
                expense,
                profit,
                margin,
              }),
            ),
          )}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[industry, series].map((m, i) => (
            <DonutCard
              key={m.title}
              title={m.title}
              badge={m.badge ?? undefined}
              note={m.note ?? undefined}
              legend={m.legend}
              listOrder="value"
              valueKind={m.valueKind}
              extraHeader={m.valueKind === "money" ? "수량" : undefined}
              {...m.donut}
              csvName={csv(i === 0 ? "산업분야" : "제품별")}
              footer={
                <>
                  <p>{m.basis}</p>
                  {m.excluded && <p className="mt-1">{m.excluded}</p>}
                </>
              }
            />
          ))}
        </div>
      </Area>

      {/* ④ 팀별 현황 (생산·서비스 — 2026-11-03 통합 1단계) */}
      <Area id="area-teams" title={L.areas.teams}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TeamCard card={productionCardModel(teams.production)} />
          <TeamCard card={serviceCardModel(teams.service)} />
        </div>
      </Area>
    </>
  );
}

/** 영역 ⑤ AI 분석 제목 (카드는 page.tsx 에서 AiCommentSection — 실제 숫자 분석 차단은 그대로) */
export function AiArea({ children }: { children: React.ReactNode }) {
  return (
    <Area id="area-ai" title={L.areas.ai}>
      {children}
    </Area>
  );
}
