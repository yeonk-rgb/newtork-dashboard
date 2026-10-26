// 경영지원 상세 (/management): 표·수치 위주, 금액은 원 단위 전체
import "server-only";

import { serializeBigInt } from "@/shared/format/bigint";

import type { CashForecast } from "../../metrics/cash-forecast";
import { CASH_FORECAST_BASIS } from "../../metrics/settings";
import type { TrendPoint } from "../../metrics/trend";
import type { ManagementSummary } from "../../metrics/types";
import { comparisonNote } from "../confirmation-text";
import { BreakEvenTable } from "./break-even-table";
import { CashForecastSection } from "./cash-forecast-section";
import {
  AnnualTargetCard,
  BreakEvenCard,
  ProfitStructureCard,
  ReceivablesDonutCard,
} from "./detail-cards";
import { ExpenseTable } from "./expense-table";
import { ProductivityCard } from "./productivity-card";
import { ReceivablesSection } from "./receivables-section";
import { RevenueMixChart } from "./revenue-mix-chart";
import {
  ProfitTable,
  QuarterTargetsTable,
  RevenueTable,
} from "./summary-tables";
import { previousLabel, showLastYear } from "./table-parts";

export function ManagementDetail({
  summary,
  trend,
  forecast,
}: {
  summary: ManagementSummary;
  trend: TrendPoint[];
  /** 자금 수지 예측 (오늘 기준 — 위에서 고른 기간과 무관) */
  forecast: CashForecast;
}) {
  const { period, expenses, changes } = summary;
  const withLastYear = showLastYear(period);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RevenueTable summary={summary} />
        <ExpenseTable
          label={summary.label}
          comparisonNote={comparisonNote(period, changes)}
          {...serializeBigInt({
            total: expenses.total,
            items: expenses.items,
            otherItems: expenses.otherItems,
          })}
          previousLabel={previousLabel(period)}
          previous={changes.previous.expenseItems}
          lastYear={withLastYear ? changes.lastYear.expenseItems : null}
          totalPrevious={changes.previous.expense}
          totalLastYear={withLastYear ? changes.lastYear.expense : null}
        />
        {/* 경영 대시보드에서 옮겨 온 카드는 관련 표 옆으로 (2026-10-25) */}
        <ProfitTable summary={summary} />
        <ProfitStructureCard summary={summary} />
        <QuarterTargetsTable summary={summary} />
        <AnnualTargetCard summary={summary} />
      </div>

      {/* #break-even = 메인 "BEP 달성률 →" 도착 지점: BEP 카드(옆 인당 생산성) → 계산 내역 표 */}
      <div id="break-even" className="scroll-mt-4 space-y-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <BreakEvenCard summary={summary} />
          <ProductivityCard summary={summary} />
        </div>
        <BreakEvenTable summary={summary} />
      </div>

      <RevenueMixChart
        points={serializeBigInt(
          trend.map(({ year, month, status, product, goods, service }) => ({
            year,
            month,
            status,
            product,
            goods,
            service,
          })),
        )}
      />

      <ReceivablesSection
        receivables={summary.receivables}
        lead={<ReceivablesDonutCard summary={summary} />}
      />

      {/* #cash-forecast — 외상매출금·경영지원 관리를 쓰므로 미수금 아래 (2026-10-26 PR ⑤) */}
      <CashForecastSection
        forecast={serializeBigInt({
          ...forecast,
          asOf: forecast.asOf.toISOString().slice(0, 10),
        })}
        basis={CASH_FORECAST_BASIS}
      />
    </div>
  );
}
