// 경영지원 상세 (/management): 표·수치 위주, 금액은 원 단위 전체
import "server-only";

import { serializeBigInt } from "@/shared/format/bigint";

import type { TrendPoint } from "../../metrics/trend";
import type { ManagementSummary } from "../../metrics/types";
import { ExpenseTable } from "./expense-table";
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
}: {
  summary: ManagementSummary;
  trend: TrendPoint[];
}) {
  const { period, expenses, changes } = summary;
  const withLastYear = showLastYear(period);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <RevenueTable summary={summary} />
        <ExpenseTable
          label={summary.label}
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
        <ProfitTable summary={summary} />
        <QuarterTargetsTable summary={summary} />
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

      <ReceivablesSection receivables={summary.receivables} />
    </div>
  );
}
