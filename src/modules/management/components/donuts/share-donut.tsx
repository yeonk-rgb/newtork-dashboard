"use client";
// 비중 원형 그래프 (산업분야·제품 시리즈): 조각은 고정 순서(색 인접 검증 순서), 옆 목록은 금액 큰 순.
// 금액은 서버에서 serializeBigInt 로 받은 정수 문자열.
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatWon, formatWonCompact } from "@/shared/format/money";
import { CHART_SURFACE } from "@/shared/ui/chart-colors";

import { ChartCard } from "./chart-card";

export type ShareItem = {
  key: string;
  label: string;
  amount: string;
  quantity: number;
};

type Row = ShareItem & { value: number; ratio: number; color: string };

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const FALLBACK_COLOR = "#8c8b86";

function TooltipBody({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="flex items-center gap-1.5 font-medium">
        <span
          aria-hidden
          className="size-2.5 rounded-sm"
          style={{ background: row.color }}
        />
        {row.label}
      </p>
      <p className="mt-1 tabular-nums">{formatWon(row.amount)}</p>
      <p className="text-muted-foreground">
        {pct(row.ratio)} · {row.quantity.toLocaleString("ko-KR")}대
      </p>
    </div>
  );
}

export function ShareDonut({
  title,
  badge,
  note,
  emptyText = "이 기간에 데이터가 없습니다.",
  items,
  order,
  colors,
}: {
  title: string;
  badge?: string;
  /** 카드 아래 작은 안내 (예: 합계는 확정 매출, 비중은 가상) */
  note?: string;
  emptyText?: string;
  items: ShareItem[];
  /** 조각 순서 (색 인접 검증 순서) */
  order: string[];
  colors: Record<string, string>;
}) {
  const [showTable, setShowTable] = useState(false);

  const total = items.reduce((acc, item) => acc + BigInt(item.amount), 0n);
  const rows: Row[] = items.map((item) => ({
    ...item,
    value: Number(item.amount),
    ratio: total === 0n ? 0 : Number(item.amount) / Number(total),
    color: colors[item.key] ?? FALLBACK_COLOR,
  }));
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i < 0 ? order.length : i;
  };
  const slices = [...rows].sort((a, b) => rank(a.key) - rank(b.key));
  const list = [...rows].sort((a, b) => b.value - a.value);

  const toggle = (
    <button
      type="button"
      onClick={() => setShowTable((v) => !v)}
      aria-pressed={showTable}
      className="shrink-0 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
    >
      {showTable ? "그래프로 보기" : "표로 보기"}
    </button>
  );

  if (rows.length === 0 || total === 0n) {
    return (
      <ChartCard title={title} badge={badge}>
        <p className="py-16 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title={title} badge={badge} action={toggle}>
      {showTable ? (
        <table className="w-full text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-1.5 text-left font-normal">항목</th>
              <th className="py-1.5 text-right font-normal">금액(원)</th>
              <th className="py-1.5 text-right font-normal">비율</th>
              <th className="py-1.5 text-right font-normal">수량</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {list.map((row) => (
              <tr key={row.key} className="border-b last:border-0">
                <td className="py-1.5">{row.label}</td>
                <td className="py-1.5 text-right">
                  {formatWon(row.amount).replace("원", "")}
                </td>
                <td className="py-1.5 text-right">{pct(row.ratio)}</td>
                <td className="py-1.5 text-right">
                  {row.quantity.toLocaleString("ko-KR")}
                </td>
              </tr>
            ))}
            <tr className="font-medium">
              <td className="py-1.5">합계</td>
              <td className="py-1.5 text-right">
                {formatWon(total).replace("원", "")}
              </td>
              <td className="py-1.5 text-right">100%</td>
              <td className="py-1.5 text-right">
                {rows
                  .reduce((acc, r) => acc + r.quantity, 0)
                  .toLocaleString("ko-KR")}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <div
            className="relative h-44 w-44 shrink-0"
            role="img"
            aria-label={`${title}: ${list.map((r) => `${r.label} ${pct(r.ratio)}`).join(", ")}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="58%"
                  outerRadius="95%"
                  startAngle={90}
                  endAngle={-270}
                  stroke={CHART_SURFACE}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {slices.map((row) => (
                    <Cell key={row.key} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip content={<TooltipBody />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] text-muted-foreground">합계</span>
              <span
                className="text-base font-semibold"
                title={formatWon(total)}
              >
                {formatWonCompact(total)}
              </span>
            </div>
          </div>
          {/* 범례 겸 값 목록 — 색만으로 구분하지 않도록 이름·금액·% 를 함께 */}
          <ul className="w-full min-w-0 space-y-1 text-sm">
            {list.map((row) => (
              <li key={row.key} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: row.color }}
                />
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <span className="tabular-nums" title={formatWon(row.amount)}>
                  {formatWonCompact(row.amount)}
                </span>
                <span className="w-12 text-right text-muted-foreground tabular-nums">
                  {pct(row.ratio)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {note && <p className="mt-3 text-[11px] text-muted-foreground">{note}</p>}
    </ChartCard>
  );
}
