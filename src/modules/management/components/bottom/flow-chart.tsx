"use client";
// 월별 매출·지출 막대(위) + 이익률 선(아래). 두 차트가 같은 가로축(월)을 공유 — 세로축 2개(이중 축) 금지.
// 미확정(DRAFT) 월: 빗금 + "미확정" 표시 / 데이터 없는 달·마감 전 달: 빈칸 (0으로 그리지 않음)
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatWon, formatWonCompact } from "@/shared/format/money";
import { CHART_GRID, CHART_INK, FLOW_COLORS } from "@/shared/ui/chart-colors";

import { ChartCard } from "../donuts/chart-card";
import { chipClass } from "@/shared/ui/styles";

/** 서버에서 serializeBigInt 로 받은 추이 (금액 = 정수 문자열 | null) */
export type FlowPoint = {
  year: number;
  month: number;
  status: "CONFIRMED" | "DRAFT" | "MISSING" | "PENDING";
  revenue: string | null;
  expense: string | null;
  profit: string | null;
  margin: number | null;
};

type Row = FlowPoint & {
  key: string;
  revenueValue: number | null;
  expenseValue: number | null;
  /** 이익률(%) — 확정 월 선 */
  marginConfirmed: number | null;
  /** 이익률(%) — 미확정 월 점 */
  marginDraft: number | null;
};

const INK = CHART_INK; // 단일 계열 선: 본문 보조 잉크 (계열색 아님)
const GRID = CHART_GRID;
const AXIS_WIDTH = 56; // 위·아래 차트의 세로축 폭을 같게 → 가로축 정렬
const STATUS_TEXT: Record<FlowPoint["status"], string> = {
  CONFIRMED: "확정",
  DRAFT: "미확정",
  MISSING: "데이터 없음",
  PENDING: "마감 전",
};

const pct = (v: number | null) => (v === null ? "-" : `${v.toFixed(1)}%`);

function toRows(points: FlowPoint[]): Row[] {
  return points.map((p) => ({
    ...p,
    key: `${p.year}-${p.month}`,
    revenueValue: p.revenue === null ? null : Number(p.revenue),
    expenseValue: p.expense === null ? null : Number(p.expense),
    marginConfirmed:
      p.status === "CONFIRMED" && p.margin !== null ? p.margin * 100 : null,
    marginDraft:
      p.status === "DRAFT" && p.margin !== null ? p.margin * 100 : null,
  }));
}

/** 가로축 눈금: 월 + (첫 칸·1월) 연도 / 미확정 / 없음 */
function MonthTick({
  x,
  y,
  payload,
  rows,
}: {
  x?: number;
  y?: number;
  payload?: { value: string; index: number };
  rows: Row[];
}) {
  const row = rows.find((r) => r.key === payload?.value);
  if (!row || x === undefined || y === undefined) return null;
  const second =
    row.status === "DRAFT"
      ? "미확정"
      : row.status === "MISSING"
        ? "없음"
        : row.status === "PENDING"
          ? "마감 전"
          : payload?.index === 0 || row.month === 1
            ? String(row.year)
            : "";
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        dy={12}
        textAnchor="middle"
        className="fill-muted-foreground text-xs"
      >
        {row.month}월
      </text>
      {second && (
        <text
          dy={25}
          textAnchor="middle"
          className={
            row.status === "DRAFT"
              ? "fill-foreground text-[10px] font-medium"
              : "fill-muted-foreground text-[10px]"
          }
        >
          {second}
        </text>
      )}
    </g>
  );
}

function FlowTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs">
      <p className="font-medium">
        {row.year}년 {row.month}월{" "}
        <span className="font-normal text-muted-foreground">
          · {STATUS_TEXT[row.status]}
        </span>
      </p>
      {row.revenue === null ? (
        <p className="mt-1 text-muted-foreground">값 없음</p>
      ) : (
        <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 tabular-nums">
          <dt className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 rounded-sm"
              style={{ background: FLOW_COLORS.revenue }}
            />
            매출
          </dt>
          <dd className="text-right">{formatWon(row.revenue)}</dd>
          <dt className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 rounded-sm"
              style={{ background: FLOW_COLORS.expense }}
            />
            지출
          </dt>
          <dd className="text-right">{formatWon(row.expense ?? "0")}</dd>
          <dt>이익</dt>
          <dd className="text-right">{formatWon(row.profit ?? "0")}</dd>
          <dt>이익률</dt>
          <dd className="text-right">
            {pct(row.margin === null ? null : row.margin * 100)}
          </dd>
        </dl>
      )}
    </div>
  );
}

/** 미확정 월 막대: 같은 색의 빗금 (색 + 무늬로 구분, 색에만 의존하지 않음) */
function Hatch({ id, color }: { id: string; color: string }) {
  return (
    <pattern
      id={id}
      width="6"
      height="6"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width="6" height="6" fill={color} opacity={0.25} />
      <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="3" />
    </pattern>
  );
}

function FlowTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm [&_td]:px-3 [&_th]:px-3">
        <caption className="sr-only">월별 매출·지출·이익률</caption>
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr className="border-b">
            {["월", "상태", "매출(원)", "지출(원)", "이익(원)", "이익률"].map(
              (h, i) => (
                <th
                  key={h}
                  className={`py-3 font-medium ${i < 2 ? "text-left" : "text-right"}`}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.key} className="border-b last:border-0">
              <td className="py-3">
                {r.year}-{String(r.month).padStart(2, "0")}
              </td>
              <td className="py-3">{STATUS_TEXT[r.status]}</td>
              <td className="py-3 text-right">
                {r.revenue === null
                  ? "-"
                  : formatWon(r.revenue).replace("원", "")}
              </td>
              <td className="py-3 text-right">
                {r.expense === null
                  ? "-"
                  : formatWon(r.expense).replace("원", "")}
              </td>
              <td className="py-3 text-right">
                {r.profit === null
                  ? "-"
                  : formatWon(r.profit).replace("원", "")}
              </td>
              <td className="py-3 text-right">
                {pct(r.margin === null ? null : r.margin * 100)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FlowChart({
  points,
  highlight,
}: {
  points: FlowPoint[];
  /** 선택 기간의 달 — 이 달만 진한 색, 나머지는 연한 톤 (표시만, 값은 같음). 없으면 전부 진한 색 */
  highlight?: { year: number; month: number }[];
}) {
  const [showTable, setShowTable] = useState(false);
  const rows = toRows(points);
  const inHighlight = (r: Row) =>
    !highlight ||
    highlight.some((m) => m.year === r.year && m.month === r.month);
  const hasAny = rows.some((r) => r.revenueValue !== null);
  const hasDraft = rows.some((r) => r.status === "DRAFT");
  const first = rows[0];
  const last = rows.at(-1)!;
  const title = `월별 매출·지출 (${first.year}.${first.month} ~ ${last.year}.${last.month})`;

  const toggle = (
    <button
      type="button"
      onClick={() => setShowTable((v) => !v)}
      aria-pressed={showTable}
      className={chipClass}
    >
      {showTable ? "그래프로 보기" : "표로 보기"}
    </button>
  );

  if (!hasAny) {
    return (
      <ChartCard title={title}>
        <p className="py-16 text-center text-sm text-muted-foreground">
          이 기간에 데이터가 없습니다.
        </p>
      </ChartCard>
    );
  }

  const tick = (props: object) => <MonthTick {...props} rows={rows} />;

  return (
    <ChartCard title={title} action={toggle}>
      {showTable ? (
        <FlowTable rows={rows} />
      ) : (
        <>
          {/* 범례: 항상 표시 (2개 계열 + 미확정 무늬) */}
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 rounded-sm"
                style={{ background: FLOW_COLORS.revenue }}
              />
              매출
            </li>
            <li className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 rounded-sm"
                style={{ background: FLOW_COLORS.expense }}
              />
              지출
            </li>
            {hasDraft && (
              <li className="flex items-center gap-2">
                <svg aria-hidden width="10" height="10">
                  <defs>
                    <Hatch id="legend-hatch" color={INK} />
                  </defs>
                  <rect
                    width="10"
                    height="10"
                    rx="2"
                    fill="url(#legend-hatch)"
                  />
                </svg>
                빗금 = 미확정 (참고용)
              </li>
            )}
          </ul>

          <div
            className="h-56"
            role="img"
            aria-label="월별 매출과 지출 막대 차트 (표로 보기에서 값 확인)"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                syncId="flow"
                barGap={2}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <Hatch id="hatch-revenue" color={FLOW_COLORS.revenue} />
                  <Hatch id="hatch-expense" color={FLOW_COLORS.expense} />
                </defs>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="key"
                  tick={tick}
                  interval={0}
                  height={34}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                />
                <YAxis
                  width={AXIS_WIDTH}
                  tickFormatter={(v: number) => formatWonCompact(v)}
                  tick={{ fontSize: 11, fill: INK }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<FlowTooltip />}
                  cursor={{ fill: "rgba(17,24,39,0.04)" }}
                />
                <Bar
                  dataKey="revenueValue"
                  name="매출"
                  maxBarSize={16}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                >
                  {rows.map((r) => (
                    <Cell
                      key={r.key}
                      fill={
                        r.status === "DRAFT"
                          ? "url(#hatch-revenue)"
                          : inHighlight(r)
                            ? FLOW_COLORS.revenue
                            : FLOW_COLORS.revenueSoft
                      }
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="expenseValue"
                  name="지출"
                  maxBarSize={16}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                >
                  {rows.map((r) => (
                    <Cell
                      key={r.key}
                      fill={
                        r.status === "DRAFT"
                          ? "url(#hatch-expense)"
                          : inHighlight(r)
                            ? FLOW_COLORS.expense
                            : FLOW_COLORS.expenseSoft
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3 className="mt-4 text-xs font-medium text-muted-foreground">
            이익률
          </h3>
          <div
            className="h-32"
            role="img"
            aria-label="월별 이익률 선 차트 (표로 보기에서 값 확인)"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows}
                syncId="flow"
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="key"
                  tick={tick}
                  interval={0}
                  height={34}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                />
                <YAxis
                  width={AXIS_WIDTH}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11, fill: INK }}
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<FlowTooltip />} />
                {/* 확정 월: 선 (빈 달은 끊김) */}
                <Line
                  dataKey="marginConfirmed"
                  name="이익률"
                  stroke={INK}
                  strokeWidth={2}
                  dot={{ r: 4, fill: INK, strokeWidth: 0 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {/* 미확정 월: 속이 빈 점선 원 (선으로 잇지 않음) */}
                <Line
                  dataKey="marginDraft"
                  name="이익률(미확정)"
                  stroke="transparent"
                  dot={{
                    r: 4,
                    fill: "#ffffff",
                    stroke: INK,
                    strokeWidth: 1.5,
                    strokeDasharray: "2 2",
                  }}
                  activeDot={{ r: 5, fill: "#ffffff", stroke: INK }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </ChartCard>
  );
}
