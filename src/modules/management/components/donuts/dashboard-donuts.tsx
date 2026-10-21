// 경영 대시보드 원형 그래프 (AI 카드 아래)
// - 핵심 지표 4개(KPI 카드 대체): 매출 구성 / 기간 목표 달성률 / 이익 구조 / 미수금 총액
// - 목표·비중 3개: 연간 목표 / 산업분야별 매출 비중 / 제품 시리즈별 매출 비중
import "server-only";

import Link from "next/link";

import { INDUSTRIES } from "@/shared/contracts/production";
import { formatWonShort } from "@/shared/format/money";
import { periodMonths } from "@/shared/period/period";
import { toPeriodParam } from "@/shared/period/url";
import {
  INDUSTRY_COLORS,
  METER_ON_ACCENT,
  PALETTE,
  SERIES_COLORS,
} from "@/shared/ui/chart-colors";
import { DonutCard } from "@/shared/ui/donut-card";

import { alignMockToTotal } from "../../external/align-mock";
import {
  getSalesShareByIndustry,
  getSalesShareBySeries,
} from "../../external/production-mock";
import type { ManagementSummary } from "../../metrics/types";
import { comparisonNote, monthsText } from "../confirmation-text";
import {
  comparisonRows,
  Deltas,
  fromChange,
  fromMargin,
  targetTitle,
} from "../kpi-cards";
import {
  annualTargetDonut,
  periodTargetDonut,
  profitDonut,
  receivablesDonut,
  revenueDonut,
} from "./donut-cards";

const SAMPLE_BADGE = "샘플 데이터";
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export async function DashboardDonuts({
  summary,
}: {
  summary: ManagementSummary;
}) {
  const { period, changes, targets, receivables, profit } = summary;
  const [rawIndustry, rawSeries] = await Promise.all([
    getSalesShareByIndustry(period),
    getSalesShareBySeries(period),
  ]);
  // 목업이면 합계를 이 기간 확정 총매출에 맞춘다 (비중만 가상) — 통합 후 실제 데이터면 그대로
  const industry = alignMockToTotal(rawIndustry, summary.revenue.total);
  const series = alignMockToTotal(rawSeries, summary.revenue.total);
  const mockNote =
    "합계는 이 기간 확정 매출, 비중은 가상(생산팀 데이터 연동 전)";
  const csv = (name: string) => `${name}_${toPeriodParam(period)}`;

  const revenue = revenueDonut(summary);
  const periodTarget = periodTargetDonut(summary);
  const profitData = profitDonut(summary);
  const receivablesData = receivablesDonut(summary);
  // 연간 목표 = 메인의 강조 카드 1개 (코퍼 바탕) — docs/design-guide.md
  const annual = annualTargetDonut(summary, METER_ON_ACCENT);
  const over90 = receivables.aging.find((a) => a.bucket === "90+");

  const shownComparisons =
    period.unit === "month" || period.unit === "quarter"
      ? [changes.previous, changes.lastYear]
      : [changes.previous];
  const note = summary.confirmation.hasData
    ? comparisonNote(period, changes)
    : null;
  const hasPartialMark = shownComparisons.some(
    (c) => c.isPartial && (c.revenue.rate !== null || c.margin.diff !== null),
  );

  const progress = summary.annualProgress;
  const gap = progress ? (progress.rate ?? 0) - progress.elapsedRatio : 0;
  const yearMonths = (list: number[]) =>
    monthsText(list.map((month) => ({ year: period.year, month })));

  return (
    <section aria-label="원형 그래프" className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DonutCard
          title={`${summary.label} 매출`}
          {...revenue}
          csvName={csv("매출구성")}
          footer={
            <>
              <p>
                확정 {summary.confirmation.confirmedMonths.length}개월 /{" "}
                {periodMonths(period).length}개월
              </p>
              <Deltas
                suffix="%"
                rows={comparisonRows(
                  period,
                  changes,
                  (c) => c.revenue,
                  fromChange,
                )}
              />
            </>
          }
        />
        <DonutCard
          title={targetTitle(period)}
          {...periodTarget}
          csvName={csv("목표달성")}
          action={
            periodTarget.emptyText ? (
              <Link
                href="/management/targets"
                className="shrink-0 text-xs text-primary hover:underline"
              >
                목표 설정 →
              </Link>
            ) : undefined
          }
          footer={
            targets.period && (
              <>
                <p>
                  목표 {formatWonShort(targets.period.target)} · 실적{" "}
                  {formatWonShort(targets.period.actual)}
                </p>
                {targets.annual && period.unit !== "year" && (
                  <p className="mt-0.5">
                    {period.year}년 연간{" "}
                    <span className="text-foreground">
                      {targets.annual.rate === null
                        ? "-"
                        : pct(targets.annual.rate)}
                    </span>
                  </p>
                )}
              </>
            )
          }
        />
        <DonutCard
          title="이익 구조"
          {...profitData}
          csvName={csv("이익구조")}
          footer={
            summary.confirmation.hasData && (
              <>
                <p>
                  {profit.profit < 0n
                    ? `적자 ${formatWonShort(-profit.profit)} — 지출이 매출보다 많습니다`
                    : `이익 ${formatWonShort(profit.profit)} (매출 − ${profit.costMode === "purchases" ? "총지출" : "매입 제외 지출"})`}
                </p>
                <Deltas
                  suffix="%p"
                  rows={comparisonRows(
                    period,
                    changes,
                    (c) => c.margin,
                    fromMargin,
                  )}
                />
              </>
            )
          }
        />
        <DonutCard
          title="미수금 총액"
          {...receivablesData}
          valueKind="money"
          extraHeader="건수"
          csvName={csv("미수금")}
          action={
            <Link
              href={`/management?period=${toPeriodParam(period)}#receivables`}
              className="shrink-0 text-xs text-primary hover:underline"
            >
              전체 보기 →
            </Link>
          }
          footer={
            <dl className="space-y-0.5">
              <div className="flex justify-between gap-2">
                <dt>90일 초과</dt>
                <dd className="text-foreground">
                  {formatWonShort(over90?.amount ?? 0n)} · {over90?.count ?? 0}
                  건
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>수금 예정일 지남</dt>
                <dd className="text-foreground">
                  {formatWonShort(receivables.expected.overdue.amount)} ·{" "}
                  {receivables.expected.overdue.count}건
                </dd>
              </div>
            </dl>
          }
        />
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {hasPartialMark && (
        <p className="text-xs text-muted-foreground">
          * 비교 기간에 미확정 월이 섞여 있어 참고용으로만 보세요.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <DonutCard
          title={`${period.year}년 연간 목표 달성률`}
          {...annual}
          tone="accent"
          csvName={csv("연간목표")}
          footer={
            progress && (
              <>
                <p>
                  <span
                    aria-hidden
                    className="mr-1 inline-block h-3 w-0.5 bg-current align-middle"
                  />
                  {progress.basisMonth > 0 ? (
                    <>
                      연간 경과율 {pct(progress.elapsedRatio)} (
                      {progress.basisMonth}월까지 확정 기준) ·{" "}
                      <span className="font-semibold text-white">
                        진도 대비 {gap > 0 ? "▲" : gap < 0 ? "▼" : ""}
                        {Math.abs(gap * 100).toFixed(1)}%p
                        {gap > 0 ? " 앞섬" : gap < 0 ? " 뒤처짐" : ""}
                      </span>
                    </>
                  ) : (
                    "확정된 달이 없어 진도를 비교할 수 없습니다"
                  )}
                </p>
                {progress.excludedMonths.length > 0 && (
                  <p className="mt-0.5">
                    {yearMonths(progress.excludedMonths)}은 미확정이라 진도
                    비교에서 제외
                  </p>
                )}
                {progress.gapMonths.length > 0 && (
                  <p className="mt-0.5">
                    {yearMonths(progress.gapMonths)}은 미확정이라 누적 실적에서
                    빠져 있습니다
                  </p>
                )}
              </>
            )
          }
        />
        <DonutCard
          title={`${summary.label} 산업분야별 매출 비중`}
          badge={industry.source === "mock" ? SAMPLE_BADGE : undefined}
          note={industry.source === "mock" ? mockNote : undefined}
          slices={orderedShare(
            industry.items,
            INDUSTRIES.map((i) => i.key),
            INDUSTRY_COLORS,
          )}
          center={{
            value: formatWonShort(summary.revenue.total),
            label: "합계",
          }}
          extraHeader="수량"
          listOrder="value"
          emptyText={
            summary.revenue.total === 0n
              ? "이 기간에 확정된 데이터가 없습니다."
              : null
          }
          csvName={csv("산업분야")}
        />
        <DonutCard
          title={`${summary.label} 제품 시리즈별 매출 비중`}
          badge={series.source === "mock" ? SAMPLE_BADGE : undefined}
          note={series.source === "mock" ? mockNote : undefined}
          slices={orderedShare(
            series.items,
            Object.keys(SERIES_COLORS),
            SERIES_COLORS,
          )}
          center={{
            value: formatWonShort(summary.revenue.total),
            label: "합계",
          }}
          extraHeader="수량"
          listOrder="value"
          emptyText={
            summary.revenue.total === 0n
              ? "이 기간에 확정된 데이터가 없습니다."
              : null
          }
          csvName={csv("제품시리즈")}
        />
      </div>
    </section>
  );
}

/** 비중 도넛: 조각은 고정 순서(색 인접 검증 순서), 목록은 금액 큰 순 */
function orderedShare(
  items: { key: string; label: string; amount: bigint; quantity: number }[],
  order: string[],
  colors: Record<string, string>,
) {
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i < 0 ? order.length : i;
  };
  return [...items]
    .sort((a, b) => rank(a.key) - rank(b.key))
    .map((i) => ({
      key: i.key,
      label: i.label,
      value: i.amount.toString(),
      color: colors[i.key] ?? PALETTE.slate,
      extra: `${i.quantity.toLocaleString("ko-KR")}대`,
    }));
}
