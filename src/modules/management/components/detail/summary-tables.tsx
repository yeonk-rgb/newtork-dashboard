// 경영지원 상세: 매출 구성 표 / 이익 계산 / 분기별 목표 (서버 렌더, 금액은 원 단위 전체)
import { CircleAlert } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import type { ManagementSummary } from "../../metrics/types";
import { comparisonNote } from "../confirmation-text";
import {
  Amount,
  ChangeText,
  pct,
  previousLabel,
  rowClass,
  Section,
  showLastYear,
  tableClass,
  theadClass,
  thClass,
  totalRowClass,
} from "./table-parts";

export function RevenueTable({ summary }: { summary: ManagementSummary }) {
  const { period, revenue, changes } = summary;
  const withLastYear = showLastYear(period);
  const note = comparisonNote(period, changes);

  return (
    <Section
      title="매출 구성"
      description={
        <>
          {summary.label} · 확정된 달만 집계
          {note && (
            <>
              <br />
              {note}
            </>
          )}
        </>
      }
    >
      <table className={tableClass}>
        <caption className="sr-only">매출 구성</caption>
        <thead className={theadClass}>
          <tr className={rowClass}>
            <th className={`${thClass} text-left`}>항목</th>
            <th className={`${thClass} text-right`}>금액(원)</th>
            <th className={`${thClass} text-right`}>비율</th>
            <th className={`${thClass} text-right`}>
              {previousLabel(period)} 대비
            </th>
            {withLastYear && (
              <th className={`${thClass} text-right`}>전년 동기 대비</th>
            )}
          </tr>
        </thead>
        <tbody>
          {revenue.items.map((item) => (
            <tr key={item.key} className={rowClass}>
              <td className="py-2.5">{item.label}</td>
              <td className="py-2.5 text-right">
                <Amount value={item.amount} />
              </td>
              <td className="py-2.5 text-right tabular-nums">
                {pct(item.ratio)}
              </td>
              <td className="py-2.5 text-right">
                <ChangeText change={changes.previous.revenueItems[item.key]} />
              </td>
              {withLastYear && (
                <td className="py-2.5 text-right">
                  <ChangeText
                    change={changes.lastYear.revenueItems[item.key]}
                  />
                </td>
              )}
            </tr>
          ))}
          <tr className={totalRowClass}>
            <td className="py-2.5">합계 (총매출)</td>
            <td className="py-2.5 text-right">
              <Amount value={revenue.total} />
            </td>
            <td className="py-2.5 text-right">
              {revenue.total === 0n ? "-" : "100%"}
            </td>
            <td className="py-2.5 text-right">
              <ChangeText change={changes.previous.revenue} />
            </td>
            {withLastYear && (
              <td className="py-2.5 text-right">
                <ChangeText change={changes.lastYear.revenue} />
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

export function ProfitTable({ summary }: { summary: ManagementSummary }) {
  const { revenue, expenses, profit } = summary;
  const includePurchases = profit.costMode === "purchases";
  const amountOf = (key: string) =>
    expenses.items.find((i) => i.key === key)?.amount ?? 0n;
  const costRows = expenses.items.map((item) => ({
    ...item,
    excluded:
      !includePurchases &&
      (item.key === "goodsPurchase" || item.key === "materialPurchase"),
  }));

  return (
    <Section
      title="이익 계산"
      description={
        includePurchases
          ? "비용 기준: 상품·원재료 매입 포함 (이익 = 총매출 − 총지출)"
          : "비용 기준: 매입 제외 (이익 = 총매출 − 경비 − 그 외 지출, 참고용)"
      }
    >
      <table className={tableClass}>
        <caption className="sr-only">이익 계산</caption>
        <thead className={theadClass}>
          <tr className={rowClass}>
            <th className={`${thClass} text-left`}>항목</th>
            <th className={`${thClass} text-right`}>금액(원)</th>
          </tr>
        </thead>
        <tbody>
          <tr className={rowClass}>
            <td className="py-2.5">총매출</td>
            <td className="py-2.5 text-right">
              <Amount value={revenue.total} />
            </td>
          </tr>
          {costRows.map((item) => (
            <tr
              key={item.key}
              className={cn(rowClass, item.excluded && "text-muted-foreground")}
            >
              <td className="py-2.5 pl-3">
                (−) {item.label}
                {item.excluded && " · 비용 제외"}
              </td>
              <td className="py-2.5 text-right">
                {item.excluded ? "" : "−"}
                <Amount value={amountOf(item.key)} />
              </td>
            </tr>
          ))}
          <tr className={rowClass}>
            <td className="py-2.5">비용 합계</td>
            <td className="py-2.5 text-right">
              −<Amount value={profit.cost} />
            </td>
          </tr>
          <tr className={totalRowClass}>
            <td className="py-2.5">단순 이익</td>
            <td className="py-2.5 text-right">
              <Amount value={profit.profit} />
            </td>
          </tr>
          <tr>
            <td className="py-2.5">이익률 (이익 ÷ 총매출)</td>
            <td className="py-2.5 text-right tabular-nums">
              {pct(profit.margin)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        원가 처리 방식은 고객사 확인 중 (docs/05-open-questions.md 3번)
      </p>
    </Section>
  );
}

const WARNING_TEXT = {
  QUARTER_SUM_MISMATCH: "분기 목표 합계가 연간 목표와 다릅니다.",
  QUARTER_SUM_EXCEEDS_ANNUAL:
    "입력한 분기 목표 합계가 연간 목표보다 커서 빈 분기는 0으로 두었습니다.",
} as const;

export function QuarterTargetsTable({
  summary,
}: {
  summary: ManagementSummary;
}) {
  const { period, targets } = summary;
  const year = period.year;

  if (!targets.quarterTargets || !targets.quarterActuals || !targets.annual) {
    return (
      <Section title={`${year}년 분기별 목표`}>
        <p className="py-6 text-center text-sm text-muted-foreground">
          {year}년 목표가 설정되지 않았습니다. (목표 설정은 6단계)
        </p>
      </Section>
    );
  }

  const { quarters, sources, warning } = targets.quarterTargets;
  const actuals = targets.quarterActuals;
  const selectedQuarter =
    period.unit === "quarter"
      ? period.quarter
      : period.unit === "month"
        ? Math.ceil(period.month / 3)
        : null;
  const quarterSum = quarters.reduce((a, b) => a + b, 0n);
  const actualSum = actuals.reduce((a, b) => a + b, 0n);
  const annualTarget = targets.annual.target;

  return (
    <Section
      title={`${year}년 분기별 목표`}
      description="빈 분기 = (연간 − 입력한 분기 합) ÷ 빈 분기 수, 나머지 원은 마지막 빈 분기에"
    >
      {warning && (
        <p
          role="status"
          className="mb-2 flex items-center gap-1.5 rounded border border-warning/50 bg-warning-soft px-2 py-1 text-xs text-warning-strong"
        >
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          <span className="font-semibold">확인 필요 ·</span>{" "}
          {WARNING_TEXT[warning]}
        </p>
      )}
      <table className={tableClass}>
        <caption className="sr-only">{year}년 분기별 목표와 실적</caption>
        <thead className={theadClass}>
          <tr className={rowClass}>
            <th className={`${thClass} text-left`}>분기</th>
            <th className={`${thClass} text-right`}>목표(원)</th>
            <th className={`${thClass} pl-3 text-left`}>구분</th>
            <th className={`${thClass} text-right`}>확정 실적(원)</th>
            <th className={`${thClass} text-right`}>달성률</th>
          </tr>
        </thead>
        <tbody>
          {quarters.map((target, i) => {
            const q = i + 1;
            const selected = q === selectedQuarter;
            return (
              <tr
                key={q}
                className={cn(rowClass, selected && "bg-sidebar-accent/50")}
                aria-current={selected ? "true" : undefined}
              >
                <td className="py-2.5">
                  {q}분기
                  {selected && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (선택)
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-right">
                  <Amount value={target} />
                </td>
                <td className="py-2.5 pl-3 text-xs">
                  {sources[i] === "input" ? (
                    "직접 입력"
                  ) : (
                    <span className="text-muted-foreground">자동 배분</span>
                  )}
                </td>
                <td className="py-2.5 text-right">
                  <Amount value={actuals[i]} />
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {target === 0n
                    ? "-"
                    : pct(Number(actuals[i]) / Number(target))}
                </td>
              </tr>
            );
          })}
          <tr className={totalRowClass}>
            <td className="py-2.5">합계</td>
            <td className="py-2.5 text-right">
              <Amount value={quarterSum} />
            </td>
            <td className="py-2.5 pl-3 text-xs font-normal text-muted-foreground">
              연간 목표 <Amount value={annualTarget} />
            </td>
            <td className="py-2.5 text-right">
              <Amount value={actualSum} />
            </td>
            <td className="py-2.5 text-right tabular-nums">
              {pct(Number(actualSum) / Number(annualTarget))}
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}
