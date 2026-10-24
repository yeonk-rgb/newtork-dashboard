// 상세 표 공통 조각 — 금액은 축약하지 않고 원 단위 전체 (회계 자료 대조용)
import type { Period } from "@/shared/period/period";
import { formatAmount, type AmountInput } from "@/shared/format/money";
import { cn } from "@/shared/lib/utils";

import type { Change } from "../../metrics/types";
import { cardTitleClass } from "@/shared/ui/styles";

/** 원 단위 전체 금액 (단위는 표 머리글에 "(원)") */
export function Amount({ value }: { value: AmountInput }) {
  return <span className="tabular-nums">{formatAmount(value)}</span>;
}

export const pct = (v: number | null) =>
  v === null ? "-" : `${(v * 100).toFixed(1)}%`;

const REASON_TEXT: Record<string, string> = {
  "no-current-data": "이 기간에 확정 데이터 없음",
  "no-data": "비교할 확정 데이터 없음",
  "zero-base": "비교 기간 값이 0",
};

/** ▲12.3% / ▼4.5% / - (사유는 마우스 오버) */
export function ChangeText({ change }: { change: Change | undefined }) {
  if (!change || change.rate === null) {
    return (
      <span title={change?.reason ? REASON_TEXT[change.reason] : undefined}>
        -
      </span>
    );
  }
  const v = change.rate;
  return (
    <span className="tabular-nums">
      {v > 0 ? "▲" : v < 0 ? "▼" : ""}
      {Math.abs(v * 100).toFixed(1)}%
    </span>
  );
}

/** 직전 기간 이름: 전월 / 전분기 / 전년 */
export function previousLabel(period: Period) {
  if (period.unit === "month") return "전월";
  if (period.unit === "quarter") return "전분기";
  return "전년";
}

/** 월·분기만 전년 동기 열을 따로 보여준다 (연간·누적은 직전 = 전년) */
export function showLastYear(period: Period) {
  return period.unit === "month" || period.unit === "quarter";
}

export function Section({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id?: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-4 rounded-card border bg-card p-6", className)}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={cardTitleClass}>{title}</h2>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export const tableClass = "w-full text-sm [&_td]:px-3 [&_th]:px-3";
export const theadClass = "bg-muted text-xs text-muted-foreground";
export const thClass = "py-3 font-medium";
export const rowClass = "border-b";
/** 합계 행: 굵은 글자로만 구분 (보더는 1px 그대로) */
export const totalRowClass = "border-t font-semibold";
