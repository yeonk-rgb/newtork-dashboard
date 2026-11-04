"use client";
// 순위 카드 (가로 막대 + [표로 보기]) — 친구 저장소 RankingCard (교체 부품·A/S 제품 모델·출장 담당자)
// 막대·행을 누르면 관련 화면으로 (부품 → 출장지 비교, 모델·담당자 → 출장보고서 목록)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_GRID, CHART_INK, PALETTE } from "@/shared/ui/chart-colors";
import { cardTitleClass } from "@/shared/ui/styles";

export type RankItem = {
  label: string;
  value: number;
  href?: string;
  cells: (string | number)[];
};

export function RankingCard({
  title,
  valueLabel,
  columns,
  rows,
  hint,
  empty,
}: {
  title: string;
  valueLabel: string;
  columns: string[];
  rows: RankItem[];
  hint: string;
  empty: string;
}) {
  const router = useRouter();
  const [table, setTable] = useState(false);
  return (
    <section className="flex h-full min-w-0 flex-col rounded-card border bg-card p-5">
      <header className="flex items-start justify-between gap-2">
        <h3 className={cardTitleClass}>{title}</h3>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => setTable(!table)}
            className="shrink-0 text-xs text-primary hover:underline"
          >
            {table ? "그래프로 보기" : "표로 보기"}
          </button>
        )}
      </header>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{empty}</p>
      ) : table ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 font-medium">항목</th>
                <th className="py-1.5 text-right font-medium">{valueLabel}</th>
                {columns.map((c) => (
                  <th key={c} className="py-1.5 text-right font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b last:border-0">
                  <td className="py-1.5">
                    {r.href ? (
                      <Link
                        href={r.href}
                        className="text-primary hover:underline"
                      >
                        {r.label}
                      </Link>
                    ) : (
                      r.label
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {r.value.toLocaleString("ko-KR")}
                  </td>
                  {r.cells.map((c, i) => (
                    <td key={i} className="py-1.5 text-right tabular-nums">
                      {typeof c === "number" ? c.toLocaleString("ko-KR") : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="mt-3"
          style={{ height: Math.max(rows.length * 28 + 40, 160) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
              onClick={(e) => {
                const r = rows[Number(e?.activeTooltipIndex)];
                if (r?.href) router.push(r.href);
              }}
              className="cursor-pointer"
            >
              <CartesianGrid horizontal={false} stroke={CHART_GRID} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: CHART_INK, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={104}
                tick={{ fill: CHART_INK, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v) => [
                  Number(v).toLocaleString("ko-KR"),
                  valueLabel,
                ]}
              />
              <Bar
                dataKey="value"
                name={valueLabel}
                fill={PALETTE.navy}
                maxBarSize={14}
                radius={[0, 3, 3, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
