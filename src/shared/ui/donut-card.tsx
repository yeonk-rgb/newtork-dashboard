"use client";
// 도넛 카드 (참고: 가운데 큰 % + 이름, 오른쪽 색 점·%·값 목록, 아래 내보내기·표 보기)
// - 목록 줄이나 조각에 마우스를 올리거나 Tab 으로 가면 서로 강조되고 가운데 숫자가 그 항목 % 로 바뀐다
// - 색만으로 구분하지 않도록 이름·%·값을 항상 글자로 함께 보여준다
import { ChevronDown, Download } from "lucide-react";
import { useId, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { formatAmount, formatWon, formatWonShort } from "@/shared/format/money";
import { cn } from "@/shared/lib/utils";

import { CHART_SURFACE } from "./chart-colors";
import {
  donutCsv,
  donutPct,
  donutRows,
  listRows,
  type DonutSlice,
} from "./donut-data";

export type { DonutSlice } from "./donut-data";

/** 도넛 위 얇은 눈금 (예: 연간 경과율) — 12시에서 시계 방향 ratio(0~1) 위치 */
export type DonutMarker = { ratio: number; label: string };

/** 크기(176px)에 맞춘 반지름 비율 (Pie innerRadius 62%, outerRadius 95%) */
const INNER = 0.62;
const OUTER = 0.95;

export function DonutCard({
  title,
  badge,
  action,
  slices,
  ratioBase,
  center,
  valueKind = "money",
  extraHeader,
  listOrder = "slice",
  marker,
  footer,
  note,
  emptyText,
  csvName,
}: {
  title: string;
  /** 제목 옆 작은 배지 (예: 샘플 데이터) */
  badge?: string;
  /** 오른쪽 위 (예: 전체 보기 링크) */
  action?: React.ReactNode;
  slices: DonutSlice[];
  /** 비율의 분모 (정수 문자열). 없으면 조각 합계 */
  ratioBase?: string;
  /** 아무것도 고르지 않았을 때 가운데 */
  center: { value: string; label: string; title?: string };
  /** 목록 값 표시: 금액(7.09억원) / 수 */
  valueKind?: "money" | "count";
  /** 목록·표·CSV 의 추가 열 이름 (예: 건수) */
  extraHeader?: string;
  listOrder?: "slice" | "value";
  marker?: DonutMarker;
  /** 카드 아래 (증감 등, 서버에서 만든 내용) */
  footer?: React.ReactNode;
  note?: string;
  /** 있으면 그래프 대신 이 문구 */
  emptyText?: string | null;
  /** 내보내기 파일 이름 (확장자 제외) */
  csvName: string;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const switchId = useId();

  const rows = donutRows(slices, ratioBase);
  const list = listRows(rows, listOrder);
  const active = rows.find((r) => r.key === activeKey) ?? null;
  const show = (v: string) =>
    valueKind === "money"
      ? formatWonShort(v)
      : Number(v).toLocaleString("ko-KR");
  const valueHeader = valueKind === "money" ? "금액(원)" : "수";

  const exportCsv = () => {
    const blob = new Blob([donutCsv(list, valueHeader, extraHeader)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${csvName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex flex-col rounded-lg border bg-card shadow-xs">
      <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {title}
          {badge && (
            <span className="rounded border border-dashed border-muted-foreground/50 px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
              {badge}
            </span>
          )}
        </h2>
        {action}
      </header>

      <div className="flex-1 px-4 py-4">
        {emptyText ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : showTable ? (
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 text-left font-normal">항목</th>
                <th className="py-1.5 text-right font-normal">{valueHeader}</th>
                <th className="py-1.5 text-right font-normal">비율</th>
                {extraHeader && (
                  <th className="py-1.5 text-right font-normal">
                    {extraHeader}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {list.map((row) => (
                <tr key={row.key} className="border-b last:border-0">
                  <td className="py-1.5">{row.label}</td>
                  <td className="py-1.5 text-right">
                    {valueKind === "money"
                      ? formatAmount(row.value)
                      : row.value}
                  </td>
                  <td className="py-1.5 text-right">{donutPct(row.ratio)}</td>
                  {extraHeader && (
                    <td className="py-1.5 text-right">{row.extra}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="@container flex flex-col items-center gap-4 sm:flex-row">
            <div
              className="relative size-44 shrink-0"
              role="img"
              aria-label={`${title}: ${list.map((r) => `${r.label} ${donutPct(r.ratio)}`).join(", ")}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rows}
                    dataKey={(r: (typeof rows)[number]) => Number(r.value)}
                    nameKey="label"
                    innerRadius={`${INNER * 100}%`}
                    outerRadius={`${OUTER * 100}%`}
                    startAngle={90}
                    endAngle={-270}
                    stroke={CHART_SURFACE}
                    strokeWidth={2}
                    isAnimationActive={false}
                    onMouseLeave={() => setActiveKey(null)}
                  >
                    {rows.map((row) => (
                      <Cell
                        key={row.key}
                        fill={row.color}
                        opacity={active && active.key !== row.key ? 0.3 : 1}
                        onMouseEnter={() => setActiveKey(row.key)}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {marker && marker.ratio > 0 && marker.ratio < 1 && (
                <MarkerLine ratio={marker.ratio} label={marker.label} />
              )}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                <span
                  className="text-3xl font-semibold tracking-tight tabular-nums"
                  title={active ? formatWon(active.value) : center.title}
                >
                  {active ? donutPct(active.ratio) : center.value}
                </span>
                <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {active ? active.label : center.label}
                </span>
              </div>
            </div>

            <ul
              className="w-full min-w-0 space-y-1 text-sm"
              onMouseLeave={() => setActiveKey(null)}
            >
              {list.map((row) => (
                <li
                  key={row.key}
                  tabIndex={0}
                  onMouseEnter={() => setActiveKey(row.key)}
                  onFocus={() => setActiveKey(row.key)}
                  onBlur={() => setActiveKey(null)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 outline-none",
                    activeKey === row.key &&
                      "border-border bg-muted/60 shadow-xs",
                    row.muted && "text-muted-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: row.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  <span className="w-14 text-right font-semibold tabular-nums">
                    {donutPct(row.ratio)}
                  </span>
                  <span
                    className="w-20 text-right text-xs text-muted-foreground tabular-nums"
                    title={
                      valueKind === "money" ? formatWon(row.value) : undefined
                    }
                  >
                    {show(row.value)}
                    {row.extra && <span className="block">{row.extra}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {footer && (
          <div className="mt-3 text-xs text-muted-foreground">{footer}</div>
        )}
        {note && (
          <p className="mt-2 text-[11px] text-muted-foreground">{note}</p>
        )}
      </div>

      {!emptyText && (
        <footer className="flex items-center justify-between gap-2 border-t px-4 py-2">
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-primary hover:bg-muted">
              내보내기
              <ChevronDown className="size-3.5" aria-hidden />
            </summary>
            <div className="absolute bottom-full left-0 z-10 mb-1 rounded-md border bg-popover p-1 shadow-md">
              <button
                type="button"
                onClick={(e) => {
                  exportCsv();
                  (
                    e.currentTarget.closest("details") as HTMLDetailsElement
                  ).open = false;
                }}
                className="flex w-max items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-muted"
              >
                <Download className="size-3.5" aria-hidden />
                CSV로 저장
              </button>
            </div>
          </details>
          <label
            htmlFor={switchId}
            className="flex cursor-pointer items-center gap-2 text-xs text-primary"
          >
            표로 보기
            <button
              id={switchId}
              type="button"
              role="switch"
              aria-checked={showTable}
              onClick={() => setShowTable((v) => !v)}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                showTable ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform",
                  showTable && "translate-x-4",
                )}
              />
            </button>
          </label>
        </footer>
      )}
    </section>
  );
}

/** 진도 눈금: 도넛 두께를 가로지르는 짧은 선 */
function MarkerLine({ ratio, label }: { ratio: number; label: string }) {
  const angle = ratio * 2 * Math.PI - Math.PI / 2;
  const at = (r: number) => ({
    x: 50 + r * Math.cos(angle),
    y: 50 + r * Math.sin(angle),
  });
  const inner = at(INNER * 50 - 3);
  const outer = at(OUTER * 50 + 3);
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden
    >
      <title>{label}</title>
      <line
        x1={inner.x}
        y1={inner.y}
        x2={outer.x}
        y2={outer.y}
        className="stroke-foreground"
        strokeWidth={1.4}
      />
    </svg>
  );
}
