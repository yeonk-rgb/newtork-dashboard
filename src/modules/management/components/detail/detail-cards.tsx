// 경영지원 상세(/management)로 옮긴 도넛 카드 4개 (2026-10-25 메인 재구성 — 지우지 않고 관련 표 옆으로)
// 연간 목표 달성률(분기별 목표 표 옆) · 손익분기점(BEP, 계산 내역 표 위) · 이익 구조(이익 계산 표 옆) · 미수금 원형(미수금 영역 첫 줄)
// 내용은 메인에 있던 카드 그대로, 상세는 강조 카드 없이 흰 카드 (강조 카드는 메인의 목표매출 달성률 1개)
import "server-only";

import { formatWonShort } from "@/shared/format/money";
import { periodMonths } from "@/shared/period/period";
import { toPeriodParam } from "@/shared/period/url";
import { DonutCard } from "@/shared/ui/donut-card";

import type { ManagementSummary } from "../../metrics/types";
import { monthsText } from "../confirmation-text";
import {
  annualTargetDonut,
  bepDonut,
  profitDonut,
  receivablesDonut,
} from "../donuts/donut-cards";
import { comparisonRows, Deltas, fromMargin } from "../kpi-cards";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const csvOf = (summary: ManagementSummary, name: string) =>
  `${name}_${toPeriodParam(summary.period)}`;

/** 연간 목표 달성률 + 진도 눈금(경과율) — 선택 기간과 무관하게 그 해 기준 */
export function AnnualTargetCard({ summary }: { summary: ManagementSummary }) {
  const { period } = summary;
  const progress = summary.annualProgress;
  const gap = progress ? (progress.rate ?? 0) - progress.elapsedRatio : 0;
  const yearMonths = (list: number[]) =>
    monthsText(list.map((month) => ({ year: period.year, month })));
  return (
    <DonutCard
      title={`${period.year}년 연간 목표 달성률`}
      {...annualTargetDonut(summary)}
      csvName={csvOf(summary, "연간목표")}
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
                  <span className="font-semibold text-foreground">
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
              <p className="mt-1">
                {yearMonths(progress.excludedMonths)}은 미확정이라 진도 비교에서
                제외
              </p>
            )}
            {progress.gapMonths.length > 0 && (
              <p className="mt-1">
                {yearMonths(progress.gapMonths)}은 미확정이라 누적 실적에서 빠져
                있습니다
              </p>
            )}
          </>
        )
      }
    />
  );
}

/** 손익분기점(BEP) 달성률 (적용 기준 배지 + [계산 기준] 펼침) */
export function BreakEvenCard({ summary }: { summary: ManagementSummary }) {
  return (
    <DonutCard
      title={`${summary.label} 손익분기점(BEP) 달성률`}
      badge={
        summary.breakEven.appliedBasis.length > 0 ? "적용 기준" : undefined
      }
      {...bepDonut(summary)}
      csvName={csvOf(summary, "손익분기점")}
      footer={<BreakEvenFooter summary={summary} />}
    />
  );
}

/** BEP 카드 아래: BEP 매출·실제 매출·남은(초과) 매출, 고정비·공헌이익률, 미분류 안내, [계산 기준] 펼침 */
function BreakEvenFooter({ summary }: { summary: ManagementSummary }) {
  const b = summary.breakEven;
  const { confirmedMonths } = summary.confirmation;
  const months = periodMonths(summary.period).length;
  return (
    <>
      {b.bepRevenue !== null && b.gap !== null && (
        <>
          <p>
            BEP 매출 {formatWonShort(b.bepRevenue)} · 실제 매출{" "}
            {formatWonShort(b.revenue)}
          </p>
          <p className="mt-1 text-foreground">
            {b.gap > 0n
              ? `BEP 초과 ${formatWonShort(b.gap)} — 흑자`
              : b.gap === 0n
                ? "손익분기점에 딱 도달"
                : `BEP까지 남은 매출 ${formatWonShort(-b.gap)}`}
          </p>
          <p className="mt-1">
            고정비 {formatWonShort(b.fixedCost)} · 공헌이익률{" "}
            {b.contributionRatio === null ? "-" : pct(b.contributionRatio)}
          </p>
        </>
      )}
      {b.reason === "not-reachable" && (
        <p className="text-foreground">
          변동비({formatWonShort(b.variableCost)})가 매출(
          {formatWonShort(b.revenue)}) 이상이라 매출이 늘어도 손익분기점에
          도달하지 않습니다.
        </p>
      )}
      {b.reason !== "no-data" && confirmedMonths.length < months && (
        <p className="mt-1">
          확정 {confirmedMonths.length}개월 / {months}개월 기준
        </p>
      )}
      {b.unclassifiedCount > 0 && (
        <p className="mt-1">
          미분류 {b.unclassifiedCount}개 항목은 고정비로 계산
        </p>
      )}
      {b.appliedBasis.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-primary">계산 기준</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {b.appliedBasis.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/** 이익 구조: 매입·경비·이익 (매출 대비), 가운데 이익률 */
export function ProfitStructureCard({
  summary,
}: {
  summary: ManagementSummary;
}) {
  const { profit, period, changes } = summary;
  return (
    <DonutCard
      title="이익 구조"
      {...profitDonut(summary)}
      csvName={csvOf(summary, "이익구조")}
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
  );
}

/** 미수금 원형 (채권·채무 외상매출금 기준): 장기미수 / 당월 수금예정, 아래 당월 수금완료·예정일 지남 */
export function ReceivablesDonutCard({
  summary,
}: {
  summary: ManagementSummary;
}) {
  const { receivables } = summary;
  return (
    <DonutCard
      title="미수금 총액"
      {...receivablesDonut(summary)}
      valueKind="money"
      extraHeader="건수"
      csvName={csvOf(summary, "미수금")}
      footer={
        receivables.month && (
          <dl className="space-y-1">
            <div className="flex justify-between gap-2">
              <dt>당월 수금완료 (미수에 넣지 않음)</dt>
              <dd className="text-foreground">
                {formatWonShort(receivables.collected.amount)} ·{" "}
                {receivables.collected.count}건
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
        )
      }
    />
  );
}
