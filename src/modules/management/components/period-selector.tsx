"use client";
// 연도 + 기간 단위 + (월/분기) 선택 → URL ?period= 만 바꾼다. 계산은 서버가 다시 한다.
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  periodMonths,
  quarterOf,
  type Period,
  type Quarter,
} from "@/shared/period/period";
import { toPeriodParam } from "@/shared/period/url";
import { cn } from "@/shared/lib/utils";

type Unit = Period["unit"];

const UNITS: { unit: Unit; label: string }[] = [
  { unit: "month", label: "월" },
  { unit: "quarter", label: "분기" },
  { unit: "year", label: "연간" },
  { unit: "ytd", label: "연초 누적" },
];

/** 단위를 바꿀 때 현재 기간의 마지막 달을 기준으로 이어서 고른다 */
function withUnit(period: Period, unit: Unit): Period {
  const lastMonth = periodMonths(period).at(-1)!.month;
  switch (unit) {
    case "month":
      return { unit, year: period.year, month: lastMonth };
    case "quarter":
      return { unit, year: period.year, quarter: quarterOf(lastMonth) };
    case "year":
      return { unit, year: period.year };
    case "ytd":
      return { unit, year: period.year, month: lastMonth };
  }
}

const selectClass =
  "h-9 rounded-full border border-input bg-card px-3.5 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export function PeriodSelector({
  period,
  years,
}: {
  period: Period;
  years: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const go = (next: Period) => {
    startTransition(() => {
      router.replace(`${pathname}?period=${toPeriodParam(next)}`, {
        scroll: false,
      });
    });
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 transition-opacity",
        isPending && "opacity-60",
      )}
      aria-busy={isPending}
    >
      <label className="sr-only" htmlFor="period-year">
        연도
      </label>
      <select
        id="period-year"
        className={selectClass}
        value={period.year}
        onChange={(e) => go({ ...period, year: Number(e.target.value) })}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}년
          </option>
        ))}
      </select>

      <div
        role="radiogroup"
        aria-label="기간 단위"
        className="inline-flex rounded-full border border-input bg-card p-1"
      >
        {UNITS.map(({ unit, label }) => {
          const active = period.unit === unit;
          return (
            <button
              key={unit}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => !active && go(withUnit(period, unit))}
              className={cn(
                "rounded-full px-3.5 py-1 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {period.unit === "quarter" && (
        <>
          <label className="sr-only" htmlFor="period-quarter">
            분기
          </label>
          <select
            id="period-quarter"
            className={selectClass}
            value={period.quarter}
            onChange={(e) =>
              go({ ...period, quarter: Number(e.target.value) as Quarter })
            }
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                {q}분기
              </option>
            ))}
          </select>
        </>
      )}

      {(period.unit === "month" || period.unit === "ytd") && (
        <>
          <label className="sr-only" htmlFor="period-month">
            {period.unit === "ytd" ? "누적 마지막 월" : "월"}
          </label>
          <select
            id="period-month"
            className={selectClass}
            value={period.month}
            onChange={(e) => go({ ...period, month: Number(e.target.value) })}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {period.unit === "ytd" ? `1~${m}월` : `${m}월`}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
