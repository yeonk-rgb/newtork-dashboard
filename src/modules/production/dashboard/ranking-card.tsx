"use client";
// 분류별 판매량 카드 (가로 막대 + [표로 보기]) — 친구 저장소 RankingCard. 막대 = 확정 출고 수량, 표에는 수량 미확정도
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

import type { RankRow } from "../metrics/dashboard";

const EMPTY = "이 기간에 출고된 제조내역이 없습니다.";

export function RankingCard({
  title,
  rows,
  hint,
}: {
  title: string;
  rows: RankRow[];
  hint?: string;
}) {
  const [table, setTable] = useState(false);
  const has = rows.some((r) => r.confirmed > 0 || r.unconfirmed > 0);
  return (
    <section className="flex flex-col rounded-card border bg-card p-6">
      <header className="flex items-start justify-between gap-2">
        <h3 className={cardTitleClass}>{title}</h3>
        {has && (
          <button
            type="button"
            onClick={() => setTable(!table)}
            className="shrink-0 text-xs text-primary hover:underline"
          >
            {table ? "그래프로 보기" : "표로 보기"}
          </button>
        )}
      </header>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {!has ? (
        <p className="mt-6 text-sm text-muted-foreground">{EMPTY}</p>
      ) : table ? (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium">항목</th>
              <th className="py-2 text-right font-medium">확정 출고 수량</th>
              <th className="py-2 text-right font-medium">수량 미확정</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b last:border-0">
                <td className="py-1.5">{r.label}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {r.confirmed.toLocaleString("ko-KR")}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {r.unconfirmed.toLocaleString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div
          className="mt-4"
          style={{ height: Math.max(rows.length * 30 + 40, 160) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
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
                width={96}
                tick={{ fill: CHART_INK, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v) => [
                  `${Number(v).toLocaleString("ko-KR")}대`,
                  "확정 출고 수량",
                ]}
              />
              <Bar
                dataKey="confirmed"
                name="확정 출고 수량"
                fill={PALETTE.navy}
                maxBarSize={16}
                radius={[0, 3, 3, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
