"use client";
// 도넛 카드 (참고: 가운데 큰 % + 이름, 오른쪽 색 점·%·값 목록, 아래 내보내기·표 보기)
// - 목록 줄이나 조각에 마우스를 올리거나 Tab 으로 가면 서로 강조되고 가운데 숫자가 그 항목 % 로 바뀐다
// - 색만으로 구분하지 않도록 이름·%·값을 항상 글자로 함께 보여준다
import { ChevronDown, Download } from "lucide-react";
import { useId, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { formatAmount, formatWon, formatWonShort } from "@/shared/format/money";
import { cn } from "@/shared/lib/utils";

import { ACCENT_SURFACE, CHART_SURFACE } from "./chart-colors";
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

/** 크기(176px)에 맞춘 반지름 비율 — 두께 = 지름의 약 20% ((0.95-0.57)/(2×0.95)) */
const INNER = 0.57;
const OUTER = 0.95;

/**
 * 카드 색 (docs/design-guide.md)
 * - default: 흰 카드
 * - accent: 강조 카드 (코퍼 단색 + 500→600 아주 옅은 그라데이션, 흰 글씨) — 화면당 1개만 (메인 연간 목표)
 *   흰 글씨 대비: 코퍼 500 4.4:1 · 600 6.0:1 → 작은 글씨도 흰색 100% (투명도로 흐리게 하지 않음)
 */
const TONES = {
  default: {
    card: "border bg-card text-card-foreground",
    surface: CHART_SURFACE,
    muted: "text-muted-foreground",
    line: "border-border",
    rowActive: "bg-muted",
    badge: "bg-muted text-muted-foreground",
    control: "border-border text-body hover:bg-muted",
    switchOn: "bg-primary",
    switchOff: "bg-border",
    marker: "stroke-foreground",
  },
  accent: {
    card: "border border-copper-600 bg-linear-to-br from-copper-500 to-copper-600 text-white",
    surface: ACCENT_SURFACE,
    muted: "text-white",
    line: "border-white/20",
    rowActive: "bg-white/15",
    badge: "bg-white/20 text-white",
    control: "border-white/40 text-white hover:bg-white/10",
    switchOn: "bg-white/85",
    switchOff: "bg-white/30",
    marker: "stroke-white",
  },
} as const;
export type DonutTone = keyof typeof TONES;

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
  tone = "default",
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
  /** 강조 카드면 "accent" (조각 색은 호출하는 쪽에서 METER_ON_ACCENT 등으로 맞춘다) */
  tone?: DonutTone;
}) {
  const t = TONES[tone];
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
    <section className={cn("flex flex-col rounded-card", t.card)}>
      <header className="flex items-start justify-between gap-2 px-5 pt-5">
        <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
          {title}
          {badge && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                t.badge,
              )}
            >
              {badge}
            </span>
          )}
        </h2>
        {action}
      </header>

      <div className="flex-1 px-5 py-5">
        {emptyText ? (
          <p className={cn("py-12 text-center text-sm", t.muted)}>
            {emptyText}
          </p>
        ) : showTable ? (
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className={cn("text-xs", t.muted)}>
              <tr className={cn("border-b", t.line)}>
                <th className="py-2 text-left font-medium">항목</th>
                <th className="py-2 text-right font-medium">{valueHeader}</th>
                <th className="py-2 text-right font-medium">비율</th>
                {extraHeader && (
                  <th className="py-2 text-right font-medium">{extraHeader}</th>
                )}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {list.map((row) => (
                <tr
                  key={row.key}
                  className={cn("border-b last:border-0", t.line)}
                >
                  <td className="py-2">{row.label}</td>
                  <td className="py-2 text-right">
                    {valueKind === "money"
                      ? formatAmount(row.value)
                      : row.value}
                  </td>
                  <td className="py-2 text-right">{donutPct(row.ratio)}</td>
                  {extraHeader && (
                    <td className="py-2 text-right">{row.extra}</td>
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
                    stroke={t.surface}
                    strokeWidth={2}
                    cornerRadius={4}
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
                <MarkerLine
                  ratio={marker.ratio}
                  label={marker.label}
                  className={t.marker}
                />
              )}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                <span
                  className="text-[28px] leading-tight font-bold tracking-tight tabular-nums"
                  title={active ? formatWon(active.value) : center.title}
                >
                  {active ? donutPct(active.ratio) : center.value}
                </span>
                <span className={cn("mt-0.5 line-clamp-2 text-xs", t.muted)}>
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
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    activeKey === row.key && t.rowActive,
                    row.muted && t.muted,
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: row.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  <span className="w-14 text-right font-semibold tabular-nums">
                    {donutPct(row.ratio)}
                  </span>
                  <span
                    className={cn(
                      "w-20 text-right text-xs tabular-nums",
                      t.muted,
                    )}
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
        {footer && <div className={cn("mt-4 text-xs", t.muted)}>{footer}</div>}
        {note && <p className={cn("mt-2 text-[11px]", t.muted)}>{note}</p>}
      </div>

      {!emptyText && (
        <footer
          className={cn(
            "flex items-center justify-between gap-2 border-t px-5 py-3",
            t.line,
          )}
        >
          <details className="relative">
            <summary
              className={cn(
                "flex cursor-pointer list-none items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
                t.control,
              )}
            >
              내보내기
              <ChevronDown className="size-3.5" aria-hidden />
            </summary>
            <div className="absolute bottom-full left-0 z-10 mb-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-sm">
              <button
                type="button"
                onClick={(e) => {
                  exportCsv();
                  (
                    e.currentTarget.closest("details") as HTMLDetailsElement
                  ).open = false;
                }}
                className="flex w-max items-center gap-1.5 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
              >
                <Download className="size-3.5" aria-hidden />
                CSV로 저장
              </button>
            </div>
          </details>
          <label
            htmlFor={switchId}
            className="flex cursor-pointer items-center gap-2 text-xs font-medium"
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
                showTable ? t.switchOn : t.switchOff,
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-xs transition-transform",
                  tone === "accent" && showTable && "bg-copper-600",
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
function MarkerLine({
  ratio,
  label,
  className,
}: {
  ratio: number;
  label: string;
  className: string;
}) {
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
        className={className}
        strokeWidth={1.4}
      />
    </svg>
  );
}
