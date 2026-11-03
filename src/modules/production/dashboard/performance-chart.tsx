"use client";
// 월별·분기별 실적 막대 + 목표 선 (같은 세로축 — 단위가 같은 수량). 분기를 고르면 그 분기만 진하게
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_GRID, CHART_INK, PALETTE } from "@/shared/ui/chart-colors";

export type ChartRow = {
  label: string;
  confirmed: number;
  target: number | null;
  quarter: number;
};

const n = (v: unknown) =>
  typeof v === "number" ? `${v.toLocaleString("ko-KR")}대` : "-";

export function PerformanceChart({
  rows,
  highlight,
  targetLabel,
}: {
  rows: ChartRow[];
  /** 0 = 강조 없음 */
  highlight: number;
  targetLabel: string;
}) {
  const hasTarget = rows.some((r) => r.target !== null);
  const hasConfirmed = rows.some((r) => r.confirmed > 0);
  return (
    <div className="relative h-[300px]" role="img" aria-label="실적 막대그래프">
      {!hasConfirmed && (
        <p className="absolute top-1 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-card px-3 py-0.5 text-xs text-muted-foreground">
          확정 수량 없음 — 수량이 입력되면 막대로 표시됩니다
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke={CHART_GRID} />
          <XAxis
            dataKey="label"
            tick={{ fill: CHART_INK, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: CHART_GRID }}
          />
          <YAxis
            allowDecimals={false}
            width={40}
            tick={{ fill: CHART_INK, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip formatter={(v, name) => [n(v), name]} />
          <Legend
            verticalAlign="bottom"
            iconType="square"
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar
            dataKey="confirmed"
            name="확정 출고 수량"
            fill={PALETTE.navy}
            maxBarSize={rows.length <= 4 ? 56 : 28}
            radius={[3, 3, 0, 0]}
          >
            {rows.map((r) => (
              <Cell
                key={r.label}
                fill={PALETTE.navy}
                fillOpacity={!highlight || r.quarter === highlight ? 1 : 0.25}
              />
            ))}
          </Bar>
          {hasTarget && (
            <Line
              dataKey="target"
              name={targetLabel}
              stroke={PALETTE.copper}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
