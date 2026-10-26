"use client";
// 경영지원 상세 #cash-forecast — 3~6개월 자금 수지 예측 (2026-10-26 결정 05-41~46)
// 막대: 수입·지출을 예정(진한 색) + 추정(빗금)으로 쌓음. 표: 월별 예정·추정·순수지·누적·예상 잔액. 3개월 / 6개월 전환
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

import { formatAmount, formatWonCompact } from "@/shared/format/money";
import { cn } from "@/shared/lib/utils";
import { CHART_GRID, CHART_INK, PALETTE } from "@/shared/ui/chart-colors";
import { chipClass, pillClass } from "@/shared/ui/styles";

import { TERMS } from "../../terms";
import { Section } from "./table-parts";

/** serializeBigInt(CashForecast) — 금액은 정수 문자열 */
export type CashForecastView = {
  asOf: string;
  ledgerMonth: { year: number; month: number } | null;
  average: {
    months: { year: number; month: number }[];
    inflow: string;
    outflow: string;
  } | null;
  opening: {
    year: number;
    month: number;
    amount: string;
    gapMonths: number;
  } | null;
  months: {
    year: number;
    month: number;
    inflowPlanned: string;
    inflowEstimated: string | null;
    outflowPlanned: string;
    outflowEstimated: string | null;
    net: string;
    cumulative: string;
    balance: string | null;
  }[];
  notes: Record<
    | "carriedInflow"
    | "longOverdue"
    | "pastOutflow"
    | "beyondInflow"
    | "beyondOutflow",
    { amount: string; count: number }
  >;
};

const INFLOW = PALETTE.navy;
const OUTFLOW = PALETTE.copper;
const ym = (m: { year: number; month: number }) =>
  `${m.year}-${String(m.month).padStart(2, "0")}`;
const num = (v: string | null) => (v === null ? 0 : Number(v));
const won = (v: string) => `${formatAmount(BigInt(v))}원`;

function Hatch({ id, color }: { id: string; color: string }) {
  return (
    <pattern
      id={id}
      width="6"
      height="6"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width="6" height="6" fill={color} opacity={0.2} />
      <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="2.5" />
    </pattern>
  );
}

function Signed({ value, strong }: { value: string; strong?: boolean }) {
  const negative = BigInt(value) < 0n;
  return (
    <span
      className={cn(
        negative && "text-danger-strong",
        strong && "font-semibold",
      )}
    >
      {formatAmount(BigInt(value))}
    </span>
  );
}

export function CashForecastSection({
  forecast,
  basis,
}: {
  forecast: CashForecastView;
  basis: string[];
}) {
  const [count, setCount] = useState<3 | 6>(3);
  const months = forecast.months.slice(0, count);
  const rows = months.map((m) => ({
    key: `${m.month}월`,
    inflowPlanned: num(m.inflowPlanned),
    inflowEstimated: num(m.inflowEstimated),
    outflowPlanned: num(m.outflowPlanned),
    outflowEstimated: num(m.outflowEstimated),
    source: m,
  }));
  const { notes, average, opening, ledgerMonth } = forecast;
  const firstShort = months.find(
    (m) => m.balance !== null && BigInt(m.balance) < 0n,
  );

  const description = [
    `${forecast.asOf} 기준`,
    ledgerMonth
      ? `${TERMS.ledger} ${ym(ledgerMonth)}`
      : `${TERMS.ledger} 입력 없음`,
    average
      ? `추정 = 확정 ${average.months.map((m) => `${m.month}월`).join("·")} 평균`
      : "확정된 달이 없어 추정하지 않음",
  ].join(" · ");

  const noteLines = [
    notes.carriedInflow.count > 0 &&
      `수금 예정일이 없거나 지난 ${notes.carriedInflow.count}건(${won(notes.carriedInflow.amount)})은 첫 달에 넣었습니다.`,
    notes.longOverdue.count > 0 &&
      `${TERMS.longOverdue} ${notes.longOverdue.count}건(${won(notes.longOverdue.amount)})은 들어올 돈에 넣지 않았습니다.`,
    notes.pastOutflow.count > 0 &&
      `지급 예정 달이 이미 지난 ${notes.pastOutflow.count}건(${won(notes.pastOutflow.amount)})은 이미 나간 돈으로 봤습니다.`,
    notes.beyondInflow.count + notes.beyondOutflow.count > 0 &&
      `6개월 뒤로 예정된 돈은 빠져 있습니다 (들어올 ${won(notes.beyondInflow.amount)} · 나갈 ${won(notes.beyondOutflow.amount)}).`,
    opening && opening.gapMonths > 0
      ? `예상 잔액은 ${ym(opening)} 말 통장 잔액 기준입니다. 그 뒤 ${opening.gapMonths}개월(이번 달까지)의 입출금은 반영되지 않았습니다.`
      : null,
    !opening &&
      "월간 입력에 '월말 통장 잔액'을 넣으면 예상 잔액까지 보여 드립니다.",
  ].filter((v): v is string => typeof v === "string");

  const toggle = (
    <div className="flex gap-1" role="group" aria-label="예측 기간">
      {([3, 6] as const).map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={count === n}
          onClick={() => setCount(n)}
          className={cn(
            chipClass,
            count === n && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {n}개월
        </button>
      ))}
    </div>
  );

  return (
    <Section
      id="cash-forecast"
      title={`${count}개월 ${TERMS.cashflowForecast}`}
      description={
        <>
          <span
            className={cn(
              pillClass,
              "mr-2 bg-warning-soft align-middle text-warning-strong",
            )}
          >
            예측
          </span>
          {description}
        </>
      }
      action={toggle}
    >
      {firstShort && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-danger-soft px-4 py-2 text-sm font-medium text-danger-strong"
        >
          {firstShort.month}월 말 예상 잔액이{" "}
          {formatAmount(BigInt(firstShort.balance!))}원으로 부족해질 수
          있습니다.
        </p>
      )}

      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {[
          { label: "수입 예정", color: INFLOW, hatch: false },
          { label: "수입 추정", color: INFLOW, hatch: true },
          { label: "지출 예정", color: OUTFLOW, hatch: false },
          { label: "지출 추정", color: OUTFLOW, hatch: true },
        ].map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 rounded-sm"
              style={
                s.hatch
                  ? {
                      background: `repeating-linear-gradient(45deg, ${s.color} 0 2px, transparent 2px 4px)`,
                    }
                  : { background: s.color }
              }
            />
            {s.label}
          </li>
        ))}
      </ul>
      <div
        className="h-56"
        role="img"
        aria-label="월별 수입·지출 예측 막대 (아래 표에서 값 확인)"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <Hatch id="cash-hatch-in" color={INFLOW} />
              <Hatch id="cash-hatch-out" color={OUTFLOW} />
            </defs>
            <CartesianGrid vertical={false} stroke={CHART_GRID} />
            <XAxis
              dataKey="key"
              tickLine={false}
              axisLine={false}
              tick={{ fill: CHART_INK, fontSize: 12 }}
            />
            <YAxis
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{ fill: CHART_INK, fontSize: 11 }}
              tickFormatter={(v: number) => formatWonCompact(BigInt(v))}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              formatter={(value, name) => [
                `${formatAmount(BigInt(Math.round(Number(value))))}원`,
                String(name),
              ]}
            />
            <Bar
              dataKey="inflowPlanned"
              name="수입 예정"
              stackId="in"
              fill={INFLOW}
            />
            <Bar
              dataKey="inflowEstimated"
              name="수입 추정"
              stackId="in"
              fill="url(#cash-hatch-in)"
            />
            <Bar
              dataKey="outflowPlanned"
              name="지출 예정"
              stackId="out"
              fill={OUTFLOW}
            />
            <Bar
              dataKey="outflowEstimated"
              name="지출 추정"
              stackId="out"
              fill="url(#cash-hatch-out)"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm [&_td]:px-3 [&_th]:px-3">
          <caption className="sr-only">월별 자금 수지 예측</caption>
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr className="border-b">
              {[
                "월",
                "수금 예정",
                "수금 추정",
                "지급 예정",
                "지출 추정",
                "순수지",
                "누적",
                "예상 잔액",
              ].map((h, i) => (
                <th
                  key={h}
                  className={cn(
                    "py-3 font-medium",
                    i === 0 ? "text-left" : "text-right",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {months.map((m) => (
              <tr key={ym(m)} className="border-b">
                <td className="py-3">{ym(m)}</td>
                <td className="py-3 text-right">
                  {formatAmount(BigInt(m.inflowPlanned))}
                </td>
                <td className="py-3 text-right text-muted-foreground">
                  {m.inflowEstimated === null
                    ? "-"
                    : formatAmount(BigInt(m.inflowEstimated))}
                </td>
                <td className="py-3 text-right">
                  {formatAmount(BigInt(m.outflowPlanned))}
                </td>
                <td className="py-3 text-right text-muted-foreground">
                  {m.outflowEstimated === null
                    ? "-"
                    : formatAmount(BigInt(m.outflowEstimated))}
                </td>
                <td className="py-3 text-right">
                  <Signed value={m.net} strong />
                </td>
                <td className="py-3 text-right">
                  <Signed value={m.cumulative} />
                </td>
                <td className="py-3 text-right">
                  {m.balance === null ? (
                    <span className="text-muted-foreground">-</span>
                  ) : (
                    <Signed value={m.balance} strong />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        단위: 원 · 부가세 포함 · 추정(-)은 계산하지 않은 달
        {opening &&
          ` · 시작 잔액 ${ym(opening)} 말 ${formatAmount(BigInt(opening.amount))}원`}
      </p>

      {noteLines.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {noteLines.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">
          계산 기준
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {basis.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ol>
      </details>
    </Section>
  );
}
