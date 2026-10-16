// KPI 카드 4개: 매출 / (기간) 목표 달성률 / 이익률 / 미수금 총액
import { Won } from "@/shared/ui/won";
import { periodMonths, quarterOf, type Period } from "@/shared/period/period";

import type {
  Change,
  Comparison,
  ManagementSummary,
  MarginChange,
} from "../metrics/types";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const REASON_TEXT: Record<string, string> = {
  "no-current-data": "이 기간에 확정 데이터 없음",
  "no-data": "비교할 확정 데이터 없음",
  "zero-base": "비교 기간 값이 0",
  "no-margin": "매출이 0이라 이익률 없음",
};

/** ▲12.3% / ▼4.5% / 0.0% / - (계산 불가) — 화살표 + 숫자로, 색에만 의존하지 않음 */
function DeltaValue({
  value,
  suffix,
}: {
  value: number | null;
  suffix: string;
}) {
  if (value === null) return <span>-</span>;
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "";
  const abs = Math.abs(value * 100).toFixed(1);
  return (
    <span className="tabular-nums">
      {arrow}
      {abs}
      {suffix}
    </span>
  );
}

type DeltaRow = {
  label: string;
  value: number | null;
  reason?: string;
  partial: boolean;
};

function Deltas({ rows, suffix }: { rows: DeltaRow[]; suffix: string }) {
  return (
    <dl className="mt-3 space-y-0.5 text-xs text-muted-foreground">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex justify-between gap-2"
          title={
            row.reason
              ? REASON_TEXT[row.reason]
              : row.partial
                ? "미확정 월이 포함된 비교"
                : undefined
          }
        >
          <dt>
            {row.label} 대비{row.partial && row.value !== null ? "*" : ""}
          </dt>
          <dd className="text-foreground">
            <DeltaValue value={row.value} suffix={suffix} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 직전 기간 이름: 전월 / 전분기 / 전년 */
function previousLabel(period: Period) {
  if (period.unit === "month") return "전월";
  if (period.unit === "quarter") return "전분기";
  return "전년";
}

/** 연간·연초 누적은 직전 기간 = 전년 동기라 한 줄만 */
function comparisonRows<T>(
  period: Period,
  changes: ManagementSummary["changes"],
  pick: (c: Comparison) => T,
  toRow: (value: T) => { value: number | null; reason?: string },
): DeltaRow[] {
  const rows: DeltaRow[] = [
    {
      label: previousLabel(period),
      ...toRow(pick(changes.previous)),
      partial: changes.previous.isPartial,
    },
  ];
  if (period.unit === "month" || period.unit === "quarter") {
    rows.push({
      label: "전년 동기",
      ...toRow(pick(changes.lastYear)),
      partial: changes.lastYear.isPartial,
    });
  }
  return rows;
}

const fromChange = (c: Change) => ({ value: c.rate, reason: c.reason });
const fromMargin = (c: MarginChange) => ({ value: c.diff, reason: c.reason });

function targetTitle(period: Period) {
  switch (period.unit) {
    case "quarter":
      return `${period.quarter}분기 목표 달성률`;
    case "month":
      return `${quarterOf(period.month)}분기 목표 진행률 (${period.month}월까지)`;
    case "year":
      return `${period.year}년 목표 달성률`;
    case "ytd":
      return `1~${period.month}월 목표 진도율`;
  }
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-lg border bg-card p-4 shadow-xs">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

const valueClass = "mt-1 text-3xl font-semibold tracking-tight";

export function KpiCards({ summary }: { summary: ManagementSummary }) {
  const { period, changes, targets, receivables } = summary;
  const hasData = summary.confirmation.hasData;
  const over90 = receivables.aging.find((a) => a.bucket === "90+");
  const asOf = receivables.asOf;
  // "*" 가 실제로 붙은 값(미확정 포함 + 계산된 값)이 있을 때만 주석 표시
  const shownComparisons =
    period.unit === "month" || period.unit === "quarter"
      ? [changes.previous, changes.lastYear]
      : [changes.previous];
  const hasPartialMark = shownComparisons.some(
    (c) => c.isPartial && (c.revenue.rate !== null || c.margin.diff !== null),
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card title={`${summary.label} 매출`}>
        <p className={valueClass}>
          {hasData ? <Won value={summary.revenue.total} unit /> : "-"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasData
            ? `확정 ${summary.confirmation.confirmedMonths.length}개월 / ${periodMonths(period).length}개월`
            : "확정된 데이터 없음"}
        </p>
        <Deltas
          suffix="%"
          rows={comparisonRows(period, changes, (c) => c.revenue, fromChange)}
        />
      </Card>

      <Card title={targetTitle(period)}>
        {targets.period ? (
          <>
            <p className={valueClass}>
              {targets.period.rate === null ? "-" : pct(targets.period.rate)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              목표 <Won value={targets.period.target} /> · 실적{" "}
              <Won value={targets.period.actual} />
            </p>
            {targets.annual && period.unit !== "year" && (
              <p className="mt-3 text-xs text-muted-foreground">
                {period.year}년 연간{" "}
                <span className="text-foreground">
                  {targets.annual.rate === null
                    ? "-"
                    : pct(targets.annual.rate)}
                </span>
              </p>
            )}
          </>
        ) : (
          <>
            <p className={valueClass}>-</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {period.year}년 목표가 설정되지 않았습니다. (목표 설정은 6단계)
            </p>
          </>
        )}
      </Card>

      <Card title="이익률">
        <p className={valueClass}>
          {summary.profit.margin === null ? "-" : pct(summary.profit.margin)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasData ? (
            <>
              이익 <Won value={summary.profit.profit} /> (매출 −{" "}
              {summary.profit.costMode === "purchases"
                ? "총지출"
                : "매입 제외 지출"}
              )
            </>
          ) : (
            "확정된 데이터 없음"
          )}
        </p>
        <Deltas
          suffix="%p"
          rows={comparisonRows(period, changes, (c) => c.margin, fromMargin)}
        />
      </Card>

      <Card title="미수금 총액">
        <p className={valueClass}>
          <Won value={receivables.total} unit />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {receivables.count}건 · {asOf.getUTCMonth() + 1}/{asOf.getUTCDate()}{" "}
          기준
        </p>
        <dl className="mt-3 space-y-0.5 text-xs text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>90일 초과</dt>
            <dd className="text-foreground">
              <Won value={over90?.amount ?? 0n} /> · {over90?.count ?? 0}건
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>수금 예정일 지남</dt>
            <dd className="text-foreground">
              <Won value={receivables.expected.overdue.amount} /> ·{" "}
              {receivables.expected.overdue.count}건
            </dd>
          </div>
        </dl>
      </Card>

      {hasPartialMark && (
        <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">
          * 미확정 월이 포함된 비교입니다. 확정된 달만 집계하므로 기간 길이가
          달라 참고용으로만 보세요.
        </p>
      )}
    </div>
  );
}
