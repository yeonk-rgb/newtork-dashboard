"use client";
// 가격 비교 가로 막대 — 친구 저장소 PriceBarChart.vue (한 계열, 막대 끝에 값, 기준값(평균)은 세로 점선)
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_GRID, CHART_INK, PALETTE } from "@/shared/ui/chart-colors";

const won = (v: unknown) => `${Number(v).toLocaleString("ko-KR")}원`;

export function PriceBarChart({
  rows,
  refValue,
  refLabel = "평균",
  ariaLabel,
}: {
  rows: { label: string; value: number }[];
  refValue: number | null;
  refLabel?: string;
  ariaLabel: string;
}) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="w-full min-w-0"
      style={{ height: Math.max(140, rows.length * 34 + 56) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 16, right: 72, bottom: 0, left: 0 }}
        >
          <CartesianGrid horizontal={false} stroke={CHART_GRID} />
          <XAxis
            type="number"
            tickFormatter={(v) => Number(v).toLocaleString("ko-KR")}
            tick={{ fill: CHART_INK, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tick={{ fill: CHART_INK, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip formatter={(v) => [won(v), "단가(원)"]} />
          <Bar
            dataKey="value"
            name="단가(원)"
            fill={PALETTE.navy}
            maxBarSize={22}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="value"
              position="right"
              formatter={won}
              style={{ fill: "#3d4654", fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
          {refValue !== null && (
            <ReferenceLine
              x={refValue}
              stroke={PALETTE.copper}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              label={{
                value: `${refLabel} ${won(Math.round(refValue))}`,
                position: "top",
                fill: PALETTE.copper,
                fontSize: 11,
              }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
