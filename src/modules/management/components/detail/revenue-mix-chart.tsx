"use client";
// 매출 구성(제품/상품/용역) 월별 누적 막대. 미확정 월은 빗금, 빈 달은 빈칸. 표로 보기.
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  formatAmount,
  formatWon,
  formatWonCompact,
} from "@/shared/format/money";
import { CHART_SURFACE, REVENUE_COLORS } from "@/shared/ui/chart-colors";

import { ChartCard } from "../donuts/chart-card";

/** serializeBigInt 결과 */
export type MixPoint = {
  year: number;
  month: number;
  status: "CONFIRMED" | "DRAFT" | "MISSING" | "PENDING";
  product: string | null;
  goods: string | null;
  service: string | null;
};

const SERIES = [
  { key: "product", label: "제품" },
  { key: "goods", label: "상품" },
  { key: "service", label: "용역" },
] as const;

const GRID = "#e7e6e2";
const INK = "#52514e";
const STATUS_TEXT = {
  CONFIRMED: "확정",
  DRAFT: "미확정",
  MISSING: "데이터 없음",
  PENDING: "마감 전",
};

type Row = MixPoint & {
  key: string;
  productValue: number | null;
  goodsValue: number | null;
  serviceValue: number | null;
};

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

function MixTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const total =
    row.product === null
      ? null
      : BigInt(row.product) +
        BigInt(row.goods ?? "0") +
        BigInt(row.service ?? "0");
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">
        {row.year}년 {row.month}월{" "}
        <span className="font-normal text-muted-foreground">
          · {STATUS_TEXT[row.status]}
        </span>
      </p>
      {total === null ? (
        <p className="mt-1 text-muted-foreground">값 없음</p>
      ) : (
        <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 tabular-nums">
          {SERIES.map((s) => (
            <div key={s.key} className="contents">
              <dt className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2.5 rounded-sm"
                  style={{ background: REVENUE_COLORS[s.key] }}
                />
                {s.label}
              </dt>
              <dd className="text-right">{formatWon(row[s.key] ?? "0")}</dd>
            </div>
          ))}
          <dt className="font-medium">합계</dt>
          <dd className="text-right font-medium">{formatWon(total)}</dd>
        </dl>
      )}
    </div>
  );
}

export function RevenueMixChart({ points }: { points: MixPoint[] }) {
  const [showTable, setShowTable] = useState(false);
  const rows: Row[] = points.map((p) => ({
    ...p,
    key: `${p.year}-${p.month}`,
    productValue: p.product === null ? null : Number(p.product),
    goodsValue: p.goods === null ? null : Number(p.goods),
    serviceValue: p.service === null ? null : Number(p.service),
  }));
  const hasDraft = rows.some((r) => r.status === "DRAFT");
  const first = rows[0];
  const last = rows.at(-1)!;
  const title = `매출 구성 월별 추이 (${first.year}.${first.month} ~ ${last.year}.${last.month})`;
  const sum = (key: "product" | "goods" | "service") =>
    rows.reduce((acc, r) => acc + (r[key] === null ? 0n : BigInt(r[key]!)), 0n);
  const totals = {
    product: sum("product"),
    goods: sum("goods"),
    service: sum("service"),
  };

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

  return (
    <ChartCard title={title} action={toggle}>
      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">매출 구성 월별</caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                {[
                  "월",
                  "상태",
                  "제품(원)",
                  "상품(원)",
                  "용역(원)",
                  "합계(원)",
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`py-1.5 font-normal ${i < 2 ? "text-left" : "text-right"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.key} className="border-b">
                  <td className="py-1.5">
                    {r.year}-{String(r.month).padStart(2, "0")}
                  </td>
                  <td className="py-1.5">{STATUS_TEXT[r.status]}</td>
                  {(["product", "goods", "service"] as const).map((k) => (
                    <td key={k} className="py-1.5 text-right">
                      {r[k] === null ? "-" : formatAmount(r[k]!)}
                    </td>
                  ))}
                  <td className="py-1.5 text-right">
                    {r.product === null
                      ? "-"
                      : formatAmount(
                          BigInt(r.product) +
                            BigInt(r.goods ?? "0") +
                            BigInt(r.service ?? "0"),
                        )}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 font-semibold">
                <td className="py-1.5" colSpan={2}>
                  합계
                  {hasDraft && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (미확정 포함)
                    </span>
                  )}
                </td>
                <td className="py-1.5 text-right">
                  {formatAmount(totals.product)}
                </td>
                <td className="py-1.5 text-right">
                  {formatAmount(totals.goods)}
                </td>
                <td className="py-1.5 text-right">
                  {formatAmount(totals.service)}
                </td>
                <td className="py-1.5 text-right">
                  {formatAmount(totals.product + totals.goods + totals.service)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2.5 rounded-sm"
                  style={{ background: REVENUE_COLORS[s.key] }}
                />
                {s.label}
              </li>
            ))}
            {hasDraft && <li>빗금 = 미확정 (참고용)</li>}
          </ul>
          <div
            className="h-60"
            role="img"
            aria-label="매출 구성 월별 누적 막대 (표로 보기에서 값 확인)"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  {SERIES.map((s) => (
                    <Hatch
                      key={s.key}
                      id={`mix-hatch-${s.key}`}
                      color={REVENUE_COLORS[s.key]}
                    />
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="key"
                  interval={0}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                  tick={{ fontSize: 11, fill: INK }}
                  tickFormatter={(key: string) => {
                    const r = rows.find((x) => x.key === key);
                    if (!r) return "";
                    return r.status === "DRAFT"
                      ? `${r.month}월*`
                      : `${r.month}월`;
                  }}
                />
                <YAxis
                  width={56}
                  tickFormatter={(v: number) => formatWonCompact(v)}
                  tick={{ fontSize: 11, fill: INK }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<MixTooltip />}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                />
                {SERIES.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={`${s.key}Value`}
                    name={s.label}
                    stackId="mix"
                    maxBarSize={22}
                    stroke={CHART_SURFACE}
                    strokeWidth={1}
                    radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                    isAnimationActive={false}
                  >
                    {rows.map((r) => (
                      <Cell
                        key={r.key}
                        fill={
                          r.status === "DRAFT"
                            ? `url(#mix-hatch-${s.key})`
                            : REVENUE_COLORS[s.key]
                        }
                      />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {hasDraft && (
            <p className="mt-1 text-xs text-muted-foreground">* 미확정 월</p>
          )}
        </>
      )}
    </ChartCard>
  );
}
