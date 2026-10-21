// 메인 하단: 월별 매출·지출 + 이익률 / 미수금 상위 거래처 5 (AI 분석 코멘트는 KPI 아래로 이동)
import "server-only";

import Link from "next/link";

import { serializeBigInt } from "@/shared/format/bigint";
import { periodMonths } from "@/shared/period/period";
import { toPeriodParam } from "@/shared/period/url";
import { Won } from "@/shared/ui/won";

import type { TrendPoint } from "../../metrics/trend";
import type { ManagementSummary } from "../../metrics/types";
import { ChartCard } from "../donuts/chart-card";
import { FlowChart } from "./flow-chart";

const TOP_N = 5;

function ReceivablesTop({ summary }: { summary: ManagementSummary }) {
  const { receivables } = summary;
  const top = receivables.byCustomer.slice(0, TOP_N);
  const asOf = receivables.asOf;
  const more = (
    <Link
      href={`/management?period=${toPeriodParam(summary.period)}#receivables`}
      className="shrink-0 text-xs text-primary hover:underline"
    >
      전체 보기 →
    </Link>
  );

  return (
    <ChartCard
      title={`미수금 상위 거래처 (${asOf.getUTCMonth() + 1}/${asOf.getUTCDate()} 기준)`}
      action={more}
    >
      {top.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          미수금이 없습니다.
        </p>
      ) : (
        <table className="w-full text-sm [&_td]:px-3 [&_th]:px-3">
          <caption className="sr-only">미수금 상위 거래처</caption>
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2.5 text-left font-medium">순위</th>
              <th className="py-2.5 text-left font-medium">거래처</th>
              <th className="py-2.5 text-right font-medium">금액</th>
              <th className="py-2.5 text-right font-medium">건수</th>
            </tr>
          </thead>
          <tbody>
            {top.map((c, i) => (
              <tr key={c.customerName} className="border-b last:border-0">
                <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                <td className="max-w-0 truncate py-2.5" title={c.customerName}>
                  {c.customerName}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  <Won value={c.amount} />
                </td>
                <td className="py-2.5 text-right tabular-nums">{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        전체 {receivables.count}건 · <Won value={receivables.total} unit />
      </p>
    </ChartCard>
  );
}

export function MainBottom({
  summary,
  trend,
}: {
  summary: ManagementSummary;
  trend: TrendPoint[];
}) {
  return (
    <section aria-label="추이와 미수금" className="space-y-5">
      <FlowChart
        highlight={periodMonths(summary.period)}
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
      <ReceivablesTop summary={summary} />
    </section>
  );
}
