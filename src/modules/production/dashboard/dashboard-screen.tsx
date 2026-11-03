// 생산팀 대시보드 (서버) — 친구 저장소 ProductionDashboardView 화면 순서 그대로:
// KPI 5개(목표·확정 출고 수량·달성률·부족 수량·납기 예정) → 수량 미확정 안내 → 월별·분기별 실적 + 목표 달성률 → 실적 표 → 분류별 판매량
// 실적은 출고일자 기준, 납기 예정은 납기일자 기준 (섞지 않음). 상태는 주소(params.ts)
import "server-only";

import Link from "next/link";

import { getCurrentUser } from "@/shared/auth";
import { cn } from "@/shared/lib/utils";
import { METER } from "@/shared/ui/chart-colors";
import { DonutCard } from "@/shared/ui/donut-card";
import { Forbidden } from "@/shared/ui/forbidden";
import {
  cardTitleClass,
  chipClass,
  pageTitleClass,
  pillClass,
} from "@/shared/ui/styles";
import { getNow } from "@/shared/time/now";

import {
  dueEventsByMonth,
  productionBreakdown,
  productionSummary,
  type PeriodRow,
} from "../metrics/dashboard";
import { ReadOnlyBadge } from "../read-only-badge";
import { productionAbilities } from "../rules";
import { TargetDialog } from "../targets/target-dialog";
import { CsvButton, type CsvRow } from "./csv-button";
import { loadDashboardData } from "./load-dashboard";
import { NavSelect } from "./nav-select";
import {
  dashboardHref,
  parseDashboardParams,
  scopeLabel,
  scopeOf,
  withQuarter,
  withScope,
  withYear,
} from "./params";
import { PerformanceChart } from "./performance-chart";
import { RankingCard } from "./ranking-card";

const n = (v: number | null | undefined) =>
  v === null || v === undefined ? "-" : v.toLocaleString("ko-KR");
const pct = (v: number | null) =>
  v === null
    ? "-"
    : `${(v * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
const CALENDAR_READY = false;
const activeChip =
  "border-primary bg-primary text-primary-foreground hover:bg-primary";

function Kpi({
  label,
  tag,
  value,
  sub,
  accent,
}: {
  label: React.ReactNode;
  tag?: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <section className="flex flex-col rounded-card border bg-card p-5">
      <h2 className="flex flex-wrap items-center gap-1 text-sm font-semibold">
        {label}
        {tag && (
          <span className={cn(pillClass, "bg-brand-soft text-primary")}>
            {tag}
          </span>
        )}
      </h2>
      <p
        className={cn(
          "mt-2 text-[28px] leading-tight font-bold tabular-nums",
          accent && "text-primary",
        )}
      >
        {value}
      </p>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </section>
  );
}

export async function ProductionDashboardScreen({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  const abilities = productionAbilities(user);
  if (!abilities.canView) return <Forbidden user={user} />;

  const kst = new Date((await getNow()).getTime() + 9 * 3600_000);
  const today = { year: kst.getUTCFullYear(), month: kst.getUTCMonth() + 1 };
  const p = parseDashboardParams(searchParams, today);
  const { rows, targets, categories, noShippedDate, years } =
    await loadDashboardData(p.year, today.year);
  const summary = productionSummary(rows, targets, p.year);
  const breakdown = productionBreakdown(rows, categories, scopeOf(p));
  const due = dueEventsByMonth(rows, p.year);

  const periodName = p.quarter ? `${p.quarter}분기` : "연간";
  const q = p.quarter ? summary.quarters[p.quarter - 1] : null;
  const kpi: PeriodRow = q ?? summary.annual;
  const targetNote = q
    ? q.target !== null
      ? "월 목표 3개월 합"
      : q.monthTargetsSet === 0
        ? "분기 월 목표 미설정"
        : `월 목표 ${q.monthTargetsSet}/3개월만 입력 — 분기 목표 계산 안 함`
    : null;
  const yearEmpty = summary.annual.shipped === 0 && due.every((d) => d === 0);
  const monthly = Array.from(
    { length: 12 },
    (_, i) => targets.monthly.get(i + 1) ?? null,
  );
  const target = (label: string, variant: "button" | "link" = "button") => (
    <TargetDialog
      year={p.year}
      annual={targets.annual}
      monthly={monthly}
      canEdit={abilities.canEdit}
      label={label}
      variant={variant}
    />
  );
  // 납기 캘린더는 다음 PR(②-c) — 그 전까지 링크 대신 글자만
  const calendarHref = CALENDAR_READY
    ? `/production/calendar?year=${p.year}&month=${p.due}`
    : null;

  const chartRows =
    p.unit === "quarter"
      ? summary.quarters.map((r) => ({
          label: `${r.quarter}분기`,
          confirmed: r.confirmed,
          target: r.target,
          quarter: r.quarter,
        }))
      : summary.months.map((r) => ({
          label: `${r.month}월`,
          confirmed: r.confirmed,
          target: r.target,
          quarter: Math.ceil(r.month / 3),
        }));

  const tableRows: (CsvRow & { key: string; note?: string })[] =
    p.tab === "month"
      ? summary.months.map((r) => ({
          key: `m${r.month}`,
          label: `${r.month}월`,
          ...r,
        }))
      : p.tab === "quarter"
        ? summary.quarters.map((r) => ({
            key: `q${r.quarter}`,
            label: `${r.quarter}분기`,
            ...r,
            note: r.monthTargetsSet === 0 ? "미설정" : "월 목표 일부 미입력",
          }))
        : [{ key: "y", label: `${p.year}년`, ...summary.annual }];
  const csvRows: CsvRow[] = [
    ...summary.months.map((r) => ({ label: `${r.month}월`, ...r })),
    ...summary.quarters.map((r) => ({ label: `${r.quarter}분기`, ...r })),
    { label: `${p.year}년 연간`, ...summary.annual },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={`${pageTitleClass} flex flex-wrap items-center gap-3`}>
            생산팀 대시보드
            {!abilities.canEdit && (
              <ReadOnlyBadge note="목표 설정은 팀장만 할 수 있습니다" />
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            실적은 출고일자 기준, 납기 예정은 납기일자 기준 · 업로드·수정 내용이
            바로 반영됩니다
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NavSelect
            label="연도"
            value={String(p.year)}
            options={years.map((y) => ({
              value: String(y),
              label: `${y}년`,
              href: dashboardHref(p, withYear(y, today)),
            }))}
          />
          <div className="flex gap-1" role="group" aria-label="기간">
            {[0, 1, 2, 3, 4].map((v) => (
              <Link
                key={v}
                href={dashboardHref(p, withQuarter(p, v))}
                scroll={false}
                aria-current={p.quarter === v ? "true" : undefined}
                className={cn(
                  chipClass,
                  "h-10 px-4 text-sm",
                  p.quarter === v && activeChip,
                )}
              >
                {v ? `${v}분기` : "연간"}
              </Link>
            ))}
          </div>
          <CsvButton fileName={`생산팀_실적_${p.year}.csv`} rows={csvRows} />
          {target("목표 설정")}
        </div>
      </div>

      {yearEmpty && (
        <p className="rounded-card border bg-muted px-6 py-3 text-sm text-muted-foreground">
          {p.year}년에는 조회할 제조내역(출고일·납기일)이 없습니다. 해당 연도
          엑셀을 업로드하면 반영됩니다.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <Kpi
          label={`${periodName} 목표`}
          value={n(kpi.target)}
          sub={
            q
              ? kpi.target === null
                ? target(`${targetNote} — 설정하기`, "link")
                : targetNote
              : kpi.target === null
                ? target("목표 미설정 — 설정하기", "link")
                : summary.annual.monthlyTargetSum !== null &&
                  `월별 목표 합계 ${n(summary.annual.monthlyTargetSum)}`
          }
        />
        <Kpi
          label="확정 출고 수량"
          tag={periodName}
          value={n(kpi.confirmed)}
          sub="수량이 입력된 출고분만 합산"
          accent
        />
        <Kpi
          label="목표 달성률"
          tag={periodName}
          value={pct(kpi.achievement)}
          sub={
            kpi.target === null
              ? "목표 미설정"
              : `확정 출고 수량 ÷ ${periodName} 목표`
          }
        />
        <Kpi
          label="부족 수량"
          tag={periodName}
          value={n(kpi.shortfall)}
          sub={`${periodName} 목표 − 확정 출고 수량`}
        />
        <Kpi
          label={
            <>
              납기 예정
              <NavSelect
                label="납기 예정 월"
                value={String(p.due)}
                options={Array.from({ length: 12 }, (_, i) => ({
                  value: String(i + 1),
                  label: `${i + 1}월`,
                  href: dashboardHref(p, { due: i + 1 }),
                }))}
                className="h-7 rounded-md border border-input bg-background px-1 text-xs font-normal"
              />
              <span className={cn(pillClass, "bg-brand-soft text-primary")}>
                납기일 기준
              </span>
            </>
          }
          value={
            calendarHref ? (
              <Link
                href={calendarHref}
                className="hover:text-primary hover:underline"
                title={`${p.year}년 ${p.due}월 납기 캘린더 열기`}
              >
                {n(due[p.due - 1])}건
              </Link>
            ) : (
              `${n(due[p.due - 1])}건`
            )
          }
          sub={
            calendarHref ? (
              <>
                <Link
                  href={calendarHref}
                  className="text-primary hover:underline"
                >
                  {p.due}월 납기 캘린더 보기 →
                </Link>{" "}
                · 실적과 별개
              </>
            ) : (
              "같은 납기일 + 같은 수주번호 = 1건 · 실적과 별개"
            )
          }
        />
      </div>

      {kpi.unconfirmed > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-card border bg-warning-soft px-6 py-3 text-sm text-warning-strong"
        >
          <strong>
            ⚠ {p.quarter ? `${p.quarter}분기 ` : ""}수량 미확정{" "}
            {n(kpi.unconfirmed)}건
          </strong>
          <span>
            출고일은 있으나 수량이 입력되지 않아 실적에서 제외했습니다. 수량
            계산 기준은 기업 확인 후 확정됩니다.
          </span>
          <Link
            href="/production/records?shipped=yes"
            className="ml-auto underline"
          >
            제조내역에서 수량 입력 →
          </Link>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        ⓘ 출고일 없음 {n(noShippedDate)}건(전체 기간)은 어느 기간 실적에도
        포함하지 않습니다.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-card border bg-card p-6 lg:col-span-2">
          <header className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className={cardTitleClass}>
              {p.year}년 {p.unit === "month" ? "월별" : "분기별"} 실적
            </h2>
            {p.quarter > 0 && (
              <span className="text-xs text-muted-foreground">
                {p.quarter}분기 강조
              </span>
            )}
            <div
              className="ml-auto flex gap-1"
              role="group"
              aria-label="그래프 단위"
            >
              {(["month", "quarter"] as const).map((u) => (
                <Link
                  key={u}
                  href={dashboardHref(p, { unit: u })}
                  scroll={false}
                  aria-current={p.unit === u ? "true" : undefined}
                  className={cn(chipClass, p.unit === u && activeChip)}
                >
                  {u === "month" ? "월별" : "분기별"}
                </Link>
              ))}
            </div>
          </header>
          <PerformanceChart
            rows={chartRows}
            highlight={p.quarter}
            targetLabel={p.unit === "quarter" ? "분기 목표" : "월 목표"}
          />
        </section>
        {kpi.target ? (
          <DonutCard
            title={
              p.quarter
                ? `${p.year}년 ${p.quarter}분기 목표 달성률`
                : "연간 목표 달성률"
            }
            slices={[
              {
                key: "done",
                label: "확정 출고 수량",
                value: String(Math.min(kpi.confirmed, kpi.target)),
                color: METER.fill,
              },
              {
                key: "rest",
                label: "남은 목표",
                value: String(Math.max(kpi.target - kpi.confirmed, 0)),
                color: METER.track,
                muted: true,
              },
            ]}
            ratioBase={String(kpi.target)}
            valueKind="count"
            center={{
              value: pct(kpi.achievement),
              label: `${n(kpi.confirmed)} / ${n(kpi.target)}`,
            }}
            csvName={`생산_목표달성률_${p.year}${p.quarter ? `_${p.quarter}분기` : ""}`}
            layout="stacked"
            footer={<p>확정 출고 수량 기준.</p>}
          />
        ) : (
          <section className="flex flex-col rounded-card border bg-card p-6">
            <h2 className={cardTitleClass}>
              {p.quarter ? `${p.year}년 ${p.quarter}분기` : "연간"} 목표 달성률
            </h2>
            <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {p.quarter
                ? `${p.quarter}분기 목표가 없습니다(${targetNote}).`
                : "연간 목표가 설정되지 않았습니다."}
              {target("목표 설정")}
            </div>
          </section>
        )}
      </div>

      <section className="rounded-card border bg-card py-6">
        <header className="flex flex-wrap items-center gap-2 px-6 pb-3">
          <h2 className={cardTitleClass}>실적 표</h2>
          <div
            className="ml-auto flex gap-1"
            role="group"
            aria-label="실적 표 단위"
          >
            {(["month", "quarter", "year"] as const).map((t) => (
              <Link
                key={t}
                href={dashboardHref(p, { tab: t })}
                scroll={false}
                aria-current={p.tab === t ? "true" : undefined}
                className={cn(chipClass, p.tab === t && activeChip)}
              >
                {t === "month" ? "월별" : t === "quarter" ? "분기별" : "연간"}
              </Link>
            ))}
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm tabular-nums">
            <thead>
              <tr className="border-b bg-muted text-xs text-muted-foreground">
                {[
                  "기간",
                  "목표",
                  "확정 출고 수량",
                  "달성률",
                  "부족 수량",
                  "수량 미확정",
                ].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "px-6 py-2 font-medium",
                      i === 0 ? "text-left" : "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="px-6 py-2">{r.label}</td>
                  <td className="px-6 py-2 text-right">
                    {r.target !== null ? (
                      n(r.target)
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {r.note ?? "미설정"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-2 text-right font-semibold">
                    {n(r.confirmed)}
                  </td>
                  <td className="px-6 py-2 text-right">{pct(r.achievement)}</td>
                  <td className="px-6 py-2 text-right">{n(r.shortfall)}</td>
                  <td
                    className={cn(
                      "px-6 py-2 text-right",
                      r.unconfirmed > 0 && "font-semibold text-warning-strong",
                    )}
                  >
                    {n(r.unconfirmed)}
                  </td>
                </tr>
              ))}
            </tbody>
            {p.tab !== "year" && (
              <tfoot>
                <tr className="border-t-2 bg-muted font-semibold">
                  <th className="px-6 py-2 text-left">연간 합계</th>
                  <th className="px-6 py-2 text-right">
                    {summary.annual.target === null
                      ? "미설정"
                      : n(summary.annual.target)}
                  </th>
                  <th className="px-6 py-2 text-right">
                    {n(summary.annual.confirmed)}
                  </th>
                  <th className="px-6 py-2 text-right">
                    {pct(summary.annual.achievement)}
                  </th>
                  <th className="px-6 py-2 text-right">
                    {n(summary.annual.shortfall)}
                  </th>
                  <th className="px-6 py-2 text-right">
                    {n(summary.annual.unconfirmed)}
                  </th>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={cardTitleClass}>분류별 판매량</h2>
          <NavSelect
            label="분류별 판매량 기간"
            value={p.scope}
            options={[
              { value: "year", label: `${p.year}년 전체` },
              ...[1, 2, 3, 4].map((v) => ({
                value: `q${v}`,
                label: `${v}분기`,
              })),
              ...Array.from({ length: 12 }, (_, i) => ({
                value: `m${i + 1}`,
                label: `${i + 1}월`,
              })),
            ].map((o) => ({
              ...o,
              href: dashboardHref(p, withScope(p, o.value)),
            }))}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
          />
          <span className="text-xs text-muted-foreground">
            {scopeLabel(p)} 출고분
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <RankingCard
            title="산업 분야별"
            rows={breakdown.byCategory}
            hint="사업구분은 수주번호별로 직접 지정합니다. 미지정은 '미분류'."
          />
          <RankingCard title="판매처별 (상위 10)" rows={breakdown.bySeller} />
          <RankingCard
            title="제품 모델별"
            rows={breakdown.byModel}
            hint="모델명은 엑셀 값 그대로 표시합니다."
          />
        </div>
      </div>
    </div>
  );
}
