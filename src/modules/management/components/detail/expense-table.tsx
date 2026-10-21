"use client";
// 지출 항목 표: 그 외 지출은 펼쳐서 항목별로 (금액은 원 단위 전체)
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { formatAmount } from "@/shared/format/money";

/** serializeBigInt 결과 (금액 = 정수 문자열) */
type Share = {
  key: string;
  label: string;
  amount: string;
  ratio: number | null;
};
type ChangeLite = { rate: number | null; reason?: string };

const pct = (v: number | null) =>
  v === null ? "-" : `${(v * 100).toFixed(1)}%`;

function ChangeText({ change }: { change?: ChangeLite }) {
  if (!change || change.rate === null) return <span>-</span>;
  const v = change.rate;
  return (
    <span className="tabular-nums">
      {v > 0 ? "▲" : v < 0 ? "▼" : ""}
      {Math.abs(v * 100).toFixed(1)}%
    </span>
  );
}

export function ExpenseTable({
  label,
  comparisonNote,
  total,
  items,
  otherItems,
  previousLabel,
  previous,
  lastYear,
  totalPrevious,
  totalLastYear,
}: {
  label: string;
  /** 같은 기간 비교 안내 (없으면 null) */
  comparisonNote: string | null;
  total: string;
  items: Share[];
  otherItems: Share[];
  previousLabel: string;
  previous: Record<string, ChangeLite>;
  /** 월·분기만 */
  lastYear: Record<string, ChangeLite> | null;
  totalPrevious: ChangeLite;
  totalLastYear: ChangeLite | null;
}) {
  const [open, setOpen] = useState(false);
  const cols = lastYear ? 5 : 4;

  return (
    <section className="rounded-card border bg-card p-5">
      <header className="mb-3">
        <h2 className="text-sm font-semibold">지출 항목</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {label} · 확정된 달만 집계
          {comparisonNote && (
            <>
              <br />
              {comparisonNote}
            </>
          )}
        </p>
      </header>
      <table className="w-full text-sm [&_td]:px-3 [&_th]:px-3">
        <caption className="sr-only">지출 항목</caption>
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-2.5 text-left font-medium">항목</th>
            <th className="py-2.5 text-right font-medium">금액(원)</th>
            <th className="py-2.5 text-right font-medium">총지출 대비</th>
            <th className="py-2.5 text-right font-medium">
              {previousLabel} 대비
            </th>
            {lastYear && (
              <th className="py-2.5 text-right font-medium">전년 동기 대비</th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isOther = item.key === "otherExpense";
            return [
              <tr key={item.key} className="border-b">
                <td className="py-2.5">
                  {isOther && otherItems.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setOpen((v) => !v)}
                      aria-expanded={open}
                      className="-ml-1 inline-flex items-center gap-0.5 rounded px-1 hover:bg-muted"
                    >
                      {open ? (
                        <ChevronDown className="size-3.5" aria-hidden />
                      ) : (
                        <ChevronRight className="size-3.5" aria-hidden />
                      )}
                      {item.label} ({otherItems.length}개 항목)
                    </button>
                  ) : (
                    item.label
                  )}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatAmount(item.amount)}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {pct(item.ratio)}
                </td>
                <td className="py-2.5 text-right">
                  <ChangeText change={previous[item.key]} />
                </td>
                {lastYear && (
                  <td className="py-2.5 text-right">
                    <ChangeText change={lastYear[item.key]} />
                  </td>
                )}
              </tr>,
              isOther && open
                ? otherItems.map((o) => (
                    <tr
                      key={`other-${o.key}`}
                      className="border-b bg-muted/40 text-muted-foreground"
                    >
                      <td className="py-1 pl-6">└ {o.label}</td>
                      <td className="py-1 text-right text-foreground tabular-nums">
                        {formatAmount(o.amount)}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {pct(o.ratio)}
                      </td>
                      <td className="py-1" colSpan={cols - 3} />
                    </tr>
                  ))
                : null,
            ];
          })}
          <tr className="border-t-2 font-semibold">
            <td className="py-2.5">합계 (총지출)</td>
            <td className="py-2.5 text-right tabular-nums">
              {formatAmount(total)}
            </td>
            <td className="py-2.5 text-right">
              {total === "0" ? "-" : "100%"}
            </td>
            <td className="py-2.5 text-right">
              <ChangeText change={totalPrevious} />
            </td>
            {totalLastYear && (
              <td className="py-2.5 text-right">
                <ChangeText change={totalLastYear} />
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </section>
  );
}
