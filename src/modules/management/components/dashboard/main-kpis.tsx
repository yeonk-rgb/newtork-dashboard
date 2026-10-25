// 경영 대시보드 상단 KPI 4개: 매출 / 지출 / 추정 이익 / 미수금 (2026-10-25 담당자 요청)
// 숫자는 표시 모델(dashboardKpis)에서만 가져온다 — 이 파일에서 새로 계산하지 않음
import Link from "next/link";

import { formatWonShort } from "@/shared/format/money";
import { cn } from "@/shared/lib/utils";
import { cardTitleClass, pillClass } from "@/shared/ui/styles";
import { Won } from "@/shared/ui/won";

import type { ManagementSummary } from "../../metrics/types";
import { comparisonNote } from "../confirmation-text";
import { Deltas } from "../kpi-cards";
import { dashboardKpis, type DeltaRow, type KpiModel } from "./model";

/** KPI 큰 숫자: 30px Bold (기존 KPI 카드와 같은 모양) */
const valueClass =
  "mt-2 text-[30px] leading-tight font-bold tracking-[-0.02em] tabular-nums";

const REASON_TEXT: Record<string, string> = {
  "no-current-data": "이 기간에 확정 데이터 없음",
  "no-data": "비교할 확정 데이터 없음",
};

/** 이익 금액 차이: ▲4,412만원 / ▼462만원 / - — 화살표 + 금액으로 (색에만 의존하지 않음) */
function AmountDeltas({ rows }: { rows: DeltaRow<bigint>[] }) {
  return (
    <dl className="mt-4 space-y-2 text-xs text-muted-foreground">
      {rows.map((row) => {
        const v = row.value;
        return (
          <div
            key={row.label}
            className="flex items-center justify-between gap-2"
            title={
              row.reason
                ? REASON_TEXT[row.reason]
                : row.partial
                  ? "미확정 월이 포함된 비교"
                  : undefined
            }
          >
            <dt>
              {row.label} 대비{row.partial && v !== null ? "*" : ""}
            </dt>
            <dd>
              <span
                className={cn(
                  pillClass,
                  v === null || v === 0n
                    ? "bg-muted text-muted-foreground"
                    : v > 0n
                      ? "bg-success-soft text-success-strong"
                      : "bg-danger-soft text-danger-strong",
                )}
              >
                {v === null
                  ? "-"
                  : `${v > 0n ? "▲" : v < 0n ? "▼" : ""}${formatWonShort(v < 0n ? -v : v)}`}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function KpiCard({ kpi, hasData }: { kpi: KpiModel; hasData: boolean }) {
  const showValue = hasData || kpi.key === "receivables";
  return (
    <section className="flex flex-col rounded-card border bg-card p-6">
      <div className="flex items-start justify-between gap-2">
        <h2 className={cardTitleClass}>{kpi.title}</h2>
        {kpi.key === "receivables" && kpi.link && (
          <Link
            href={kpi.link.href}
            className="shrink-0 text-xs text-primary hover:underline"
          >
            {kpi.link.label} →
          </Link>
        )}
      </div>
      <p className={cn(valueClass, kpi.warn && "text-danger-strong")}>
        {!showValue ? (
          "-"
        ) : kpi.warn ? (
          <>
            <span aria-hidden>▼ </span>
            <Won value={-kpi.value} unit="subtle" />
          </>
        ) : (
          <Won value={kpi.value} unit="subtle" />
        )}
      </p>
      {(kpi.sub || !showValue) && (
        <p
          className={cn(
            "mt-1 text-xs",
            kpi.warn
              ? "font-semibold text-danger-strong"
              : "text-muted-foreground",
          )}
        >
          {showValue ? kpi.sub : "확정된 데이터 없음"}
        </p>
      )}
      {kpi.note && (
        <p className="mt-1 text-xs text-muted-foreground">{kpi.note}</p>
      )}
      {kpi.deltas?.kind === "rate" && (
        <Deltas suffix="%" rows={kpi.deltas.rows} />
      )}
      {kpi.deltas?.kind === "amount" && <AmountDeltas rows={kpi.deltas.rows} />}
      {kpi.details && (
        <dl className="mt-4 space-y-2 text-xs text-muted-foreground">
          {kpi.details.map((d) => (
            <div key={d.label} className="flex justify-between gap-2">
              <dt>{d.label}</dt>
              <dd
                className={cn(
                  d.warn
                    ? "font-semibold text-danger-strong"
                    : "text-foreground",
                )}
              >
                {formatWonShort(d.amount)} · {d.count}건
              </dd>
            </div>
          ))}
        </dl>
      )}
      {kpi.key === "profit" && kpi.link && (
        <Link
          href={kpi.link.href}
          className="mt-4 text-xs text-primary hover:underline"
        >
          {kpi.link.label} →
        </Link>
      )}
    </section>
  );
}

export function MainKpis({ summary }: { summary: ManagementSummary }) {
  const kpis = dashboardKpis(summary);
  const { period, changes } = summary;
  const hasData = summary.confirmation.hasData;
  const note = hasData ? comparisonNote(period, changes) : null;
  const shown =
    period.unit === "month" || period.unit === "quarter"
      ? [changes.previous, changes.lastYear]
      : [changes.previous];
  // "*" 가 실제로 붙은 값이 있을 때만 주석
  const hasPartialMark = shown.some(
    (c) =>
      c.isPartial &&
      (c.revenue.rate !== null ||
        c.expense.rate !== null ||
        c.profitDiff.diff !== null),
  );
  return (
    <section aria-label="핵심 지표" className="space-y-3">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} hasData={hasData} />
        ))}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {hasPartialMark && (
        <p className="text-xs text-muted-foreground">
          * 비교 기간에 미확정 월이 섞여 있어 참고용으로만 보세요.
        </p>
      )}
    </section>
  );
}
