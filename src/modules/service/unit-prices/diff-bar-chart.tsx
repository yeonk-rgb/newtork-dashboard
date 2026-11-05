"use client";
// 뉴토크 기준값 대비 차이율 가로 막대 — 친구 앱 diffBar (가운데 0% = 기준값, 쌈 = 왼쪽, 비쌈 = 오른쪽)
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_GRID, CHART_INK, PALETTE } from "@/shared/ui/chart-colors";

import { signedRate } from "./compute";

/** 쌈(−) = 네이비, 비쌈(+) = 코퍼 */
export const DIFF_BELOW = PALETTE.navy;
export const DIFF_ABOVE = PALETTE.copper;

export type DiffBar = {
  key: string;
  label: string;
  rate: number;
  detail: string;
};

export function DiffLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <i
          className="inline-block size-2.5 rounded-sm"
          style={{ background: DIFF_BELOW }}
        />
        기준값보다 쌈 (−)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i
          className="inline-block size-2.5 rounded-sm"
          style={{ background: DIFF_ABOVE }}
        />
        기준값보다 비쌈 (+)
      </span>
      <span>가운데 진한 선 = 뉴토크 기준값 (0%)</span>
    </div>
  );
}

export function DiffBarChart({
  rows,
  ariaLabel,
  selected,
  onSelect,
}: {
  rows: DiffBar[];
  ariaLabel: string;
  selected?: string | null;
  onSelect?: (key: string) => void;
}) {
  const max = Math.max(5, ...rows.map((r) => Math.abs(r.rate)));
  const edge = Math.ceil((max * 1.25) / 5) * 5;
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="w-full min-w-0"
      style={{ height: Math.max(120, rows.length * 34 + 48) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 8, right: 56, bottom: 0, left: 8 }}
        >
          <CartesianGrid horizontal={false} stroke={CHART_GRID} />
          <XAxis
            type="number"
            domain={[-edge, edge]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: CHART_INK, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={{ fill: CHART_INK, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v, _n, item) => [
              `${signedRate(Number(v))} · ${(item.payload as DiffBar).detail}`,
              "기준값 대비",
            ]}
          />
          <ReferenceLine x={0} stroke={CHART_INK} strokeWidth={2} />
          <Bar
            dataKey="rate"
            maxBarSize={20}
            isAnimationActive={false}
            cursor={onSelect ? "pointer" : undefined}
            onClick={
              onSelect
                ? (d) =>
                    onSelect((d as unknown as { payload: DiffBar }).payload.key)
                : undefined
            }
          >
            {rows.map((r) => (
              <Cell
                key={r.key}
                fill={r.rate < 0 ? DIFF_BELOW : DIFF_ABOVE}
                fillOpacity={selected && selected !== r.key ? 0.35 : 1}
              />
            ))}
            <LabelList
              dataKey="rate"
              position="right"
              formatter={(v) => signedRate(Number(v))}
              style={{ fill: "#3d4654", fontSize: 11, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
