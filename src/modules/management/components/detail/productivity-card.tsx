// 인당 생산성 (2026-10-26 기획서 "인당 생산성 지표") — 확정된 달 합계 ÷ 직원 수, BEP 카드 옆
import "server-only";

import Link from "next/link";

import { periodMonths } from "@/shared/period/period";

import type { ManagementSummary } from "../../metrics/types";
import {
  Amount,
  rowClass,
  Section,
  tableClass,
  theadClass,
  thClass,
} from "./table-parts";

export function ProductivityCard({ summary }: { summary: ManagementSummary }) {
  const p = summary.productivity;
  const { year } = summary.period;
  const confirmed = summary.confirmation.confirmedMonths.length;
  const months = periodMonths(summary.period).length;
  const targetsHref = `/management/targets?year=${year}`;

  return (
    <Section
      title={`${summary.label} 인당 생산성`}
      description={
        p.headcount === null
          ? undefined
          : `직원 ${p.headcount}명 기준 (목표·항목 설정) · 확정된 달 합계 ÷ 직원 수`
      }
    >
      {p.reason === "no-headcount" ? (
        <p className="text-sm text-muted-foreground">
          {year}년 직원 수가 없습니다.{" "}
          <Link href={targetsHref} className="text-primary hover:underline">
            목표·항목 설정에서 입력 →
          </Link>
        </p>
      ) : p.reason === "no-data" ? (
        <p className="text-sm text-muted-foreground">
          이 기간에 확정된 달이 없습니다.
        </p>
      ) : (
        <>
          <table className={tableClass}>
            <caption className="sr-only">인당 생산성</caption>
            <thead className={theadClass}>
              <tr className={rowClass}>
                <th className={`${thClass} text-left`}>항목</th>
                <th className={`${thClass} text-right`}>합계(원)</th>
                <th className={`${thClass} text-right`}>1인당(원)</th>
              </tr>
            </thead>
            <tbody>
              <tr className={rowClass}>
                <td className="py-3">매출</td>
                <td className="py-3 text-right">
                  <Amount value={summary.revenue.total} />
                </td>
                <td className="py-3 text-right font-semibold">
                  <Amount value={p.revenuePerHead ?? 0n} />
                </td>
              </tr>
              <tr>
                <td className="py-3">추정 이익</td>
                <td className="py-3 text-right">
                  <Amount value={summary.profit.profit} />
                </td>
                <td className="py-3 text-right font-semibold">
                  <Amount value={p.profitPerHead ?? 0n} />
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            {confirmed < months
              ? `확정 ${confirmed}개월 / ${months}개월 기준 · `
              : ""}
            1인당 금액은 원 단위 반올림
          </p>
        </>
      )}
    </Section>
  );
}
