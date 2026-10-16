// 메인 하단: 월별 매출·지출 + 이익률 / 미수금 상위 거래처 5 / AI 분석 코멘트(준비 중)
import "server-only";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { serializeBigInt } from "@/shared/format/bigint";
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
        <table className="w-full text-sm">
          <caption className="sr-only">미수금 상위 거래처</caption>
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-1.5 text-left font-normal">순위</th>
              <th className="py-1.5 text-left font-normal">거래처</th>
              <th className="py-1.5 text-right font-normal">금액</th>
              <th className="py-1.5 text-right font-normal">건수</th>
            </tr>
          </thead>
          <tbody>
            {top.map((c, i) => (
              <tr key={c.customerName} className="border-b last:border-0">
                <td className="py-1.5 text-muted-foreground">{i + 1}</td>
                <td className="max-w-0 truncate py-1.5" title={c.customerName}>
                  {c.customerName}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  <Won value={c.amount} />
                </td>
                <td className="py-1.5 text-right tabular-nums">{c.count}</td>
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

function AiCommentPlaceholder() {
  return (
    <ChartCard title="AI 분석 코멘트" badge="준비 중">
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
        <Sparkles className="size-6" aria-hidden />
        <p>
          이번 분기 부족한 점·매출 상황 요약과
          <br />
          다음 분기 개선점을 보여줄 자리입니다. (8단계)
        </p>
      </div>
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
    <section aria-label="추이와 미수금" className="space-y-3">
      <FlowChart
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
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ReceivablesTop summary={summary} />
        <AiCommentPlaceholder />
      </div>
    </section>
  );
}
