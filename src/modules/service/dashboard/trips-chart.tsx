"use client";
// 월별·분기별 출장 건수 — 유상·무상·미입력 누적 막대 (친구 ServiceDashboardView monthChart). 분기를 고르면 그 분기만 진하게
// 막대를 누르면 그 달(분기) 출장보고서 목록으로
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_GRID, CHART_INK } from "@/shared/ui/chart-colors";

import { BILLING_COLORS } from "./colors";

export type TripsRow = {
  label: string;
  quarter: number;
  paid: number;
  free: number;
  billingUnset: number;
  href: string;
};

const SERIES = [
  ["paid", "유상", BILLING_COLORS.paid],
  ["free", "무상", BILLING_COLORS.free],
  ["billingUnset", "미입력", BILLING_COLORS.unset],
] as const;

export function TripsChart({
  rows,
  highlight,
  empty,
}: {
  rows: TripsRow[];
  highlight: number;
  empty: boolean;
}) {
  const router = useRouter();
  const quarterly = rows.length <= 4;
  return (
    <div
      className="relative h-[300px] w-full min-w-0"
      role="img"
      aria-label={`${quarterly ? "분기별" : "월별"} 출장 건수 누적 막대그래프`}
    >
      {empty && (
        <p className="absolute top-1 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-card px-3 py-0.5 text-xs text-muted-foreground">
          이 연도에 출장 시작일이 있는 출장보고서가 없습니다
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          onClick={(e) => {
            const i = Number(e?.activeTooltipIndex);
            if (Number.isInteger(i) && rows[i]) router.push(rows[i].href);
          }}
          className="cursor-pointer"
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
            width={36}
            tick={{ fill: CHART_INK, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v, name) => [
              `${Number(v).toLocaleString("ko-KR")}건`,
              name,
            ]}
            labelFormatter={(label, payload) => {
              const r = payload?.[0]?.payload as TripsRow | undefined;
              return r
                ? `${label} · 합계 ${(r.paid + r.free + r.billingUnset).toLocaleString("ko-KR")}건 (누르면 목록)`
                : label;
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="square"
            wrapperStyle={{ fontSize: 12 }}
          />
          {SERIES.map(([key, name, color]) => (
            <Bar
              key={key}
              dataKey={key}
              name={name}
              stackId="trips"
              fill={color}
              maxBarSize={quarterly ? 56 : 22}
            >
              {rows.map((r) => (
                <Cell
                  key={r.label}
                  fill={color}
                  fillOpacity={!highlight || r.quarter === highlight ? 1 : 0.25}
                />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
