// 경영지원 상세: 손익분기점 계산 내역 — 항목별 고정비/변동비 구분·금액·분류 근거, 합계, 계산 과정 (서버 렌더, 원 단위 전체)
import { formatAmount } from "@/shared/format/money";

import type { BreakEvenItem, ManagementSummary } from "../../metrics/types";
import {
  Amount,
  pct,
  rowClass,
  Section,
  tableClass,
  theadClass,
  thClass,
  totalRowClass,
} from "./table-parts";

const CLASS_TEXT = (item: BreakEvenItem) =>
  item.basis === "unclassified"
    ? "미분류 → 고정비"
    : item.costClass === "FIXED"
      ? "고정비"
      : "변동비";

const BASIS_TEXT: Record<BreakEvenItem["basis"], string> = {
  settings: "적용 기준",
  category: "항목 설정",
  unclassified: "미분류 → 고정비",
};

const won = (v: bigint) => `${formatAmount(v)}원`;

export function BreakEvenTable({ summary }: { summary: ManagementSummary }) {
  const b = summary.breakEven;
  const steps: string[] =
    b.reason === null && b.bepRevenue !== null
      ? [
          `공헌이익 = 매출 ${won(b.revenue)} − 변동비 ${won(b.variableCost)} = ${won(b.contribution)}`,
          `공헌이익률 = 공헌이익 ${won(b.contribution)} ÷ 매출 ${won(b.revenue)} = ${pct(b.contributionRatio)}`,
          `BEP 매출 = 고정비 ${won(b.fixedCost)} ÷ 공헌이익률 ${pct(b.contributionRatio)} = ${won(b.bepRevenue)} (고정비 × 매출 ÷ 공헌이익, 원 단위 올림)`,
          `달성률 = 공헌이익 ${won(b.contribution)} ÷ 고정비 ${won(b.fixedCost)} = ${pct(b.rate)} (= 실제 매출 ÷ BEP 매출)`,
        ]
      : [REASON_TEXT[b.reason ?? "no-data"](b)];

  return (
    <Section
      title="손익분기점 계산 내역"
      description={
        b.appliedBasis.length > 0
          ? `적용 기준 — ${b.appliedBasis.join(" / ")}`
          : undefined
      }
    >
      <table className={tableClass}>
        <caption className="sr-only">손익분기점 계산 내역</caption>
        <thead className={theadClass}>
          <tr className={rowClass}>
            <th className={`${thClass} text-left`}>항목</th>
            <th className={`${thClass} text-left`}>구분</th>
            <th className={`${thClass} text-right`}>금액(원)</th>
            <th className={`${thClass} text-left`}>분류 근거</th>
          </tr>
        </thead>
        <tbody>
          {b.items.map((item) => (
            <tr key={item.key} className={rowClass}>
              <td className="py-3">{item.label}</td>
              <td className="py-3">{CLASS_TEXT(item)}</td>
              <td className="py-3 text-right">
                <Amount value={item.amount} />
              </td>
              <td className="py-3 text-muted-foreground">
                {BASIS_TEXT[item.basis]}
              </td>
            </tr>
          ))}
          <tr className={totalRowClass}>
            <td className="py-3">변동비 합계</td>
            <td />
            <td className="py-3 text-right">
              <Amount value={b.variableCost} />
            </td>
            <td />
          </tr>
          <tr className={totalRowClass}>
            <td className="py-3">고정비 합계</td>
            <td />
            <td className="py-3 text-right">
              <Amount value={b.fixedCost} />
            </td>
            <td />
          </tr>
        </tbody>
      </table>
      <ol className="mt-4 space-y-1 text-sm tabular-nums">
        {steps.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      {b.unclassifiedCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          미분류 {b.unclassifiedCount}개 항목은 고정비로 계산했습니다. 목표·항목
          설정에서 고정비/변동비를 고르면 반영됩니다.
        </p>
      )}
    </Section>
  );
}

const REASON_TEXT: Record<
  NonNullable<ManagementSummary["breakEven"]["reason"]>,
  (b: ManagementSummary["breakEven"]) => string
> = {
  "no-data": () => "이 기간에 확정된 데이터가 없어 계산하지 않았습니다.",
  "no-revenue": () => "매출이 0원이라 손익분기점을 계산할 수 없습니다.",
  "no-fixed-cost": () =>
    "고정비가 0원이라 손익분기점이 없습니다 (매출이 모두 공헌이익).",
  "not-reachable": (b) =>
    `공헌이익 = 매출 ${won(b.revenue)} − 변동비 ${won(b.variableCost)} = ${won(b.contribution)} → 0 이하라 매출이 늘어도 손익분기점에 도달하지 않습니다.`,
};
