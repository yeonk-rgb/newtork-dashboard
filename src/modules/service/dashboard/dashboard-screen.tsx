// 서비스팀 대시보드 (서버) — 친구 저장소 ServiceDashboardView.vue 화면 순서 그대로:
// KPI 4개 → 미입력 안내 → 월별·분기별 출장 건수(유상·무상·미입력 누적) → 기간별 현황(지역 지도 · 유·무상 비율 · 교체 부품·제품 모델·담당자 순위) → 실적 표(CSV)
// 기준(specs/07 S절): 출장 시작일 기준, 보고서 1건 = 출장 1건, 유상 비율 = 유상 ÷ (유상 + 무상), 금액은 계산하지 않음
// 연결: 막대·지도·순위 → 출장보고서 목록 필터, 교체 부품 → 출장지 비교 분석
import "server-only";

import Link from "next/link";

import { getCurrentUser } from "@/shared/auth";
import { cn } from "@/shared/lib/utils";
import { Forbidden } from "@/shared/ui/forbidden";
import {
  buttonPrimaryClass,
  cardTitleClass,
  chipClass,
  pageTitleClass,
  pillClass,
} from "@/shared/ui/styles";
import { getNow } from "@/shared/time/now";

import { NavSelect } from "@/shared/ui/nav-select";
import { pct, pct1, won } from "../labels";
import {
  serviceBreakdown,
  serviceSummary,
  yearsAvailable,
  type Summary,
} from "../metrics/dashboard";
import { BASE_DATE } from "../regions/regions";
import { serviceAbilities } from "../rules";
import { BILLING_COLORS } from "./colors";
import { ServiceCsvButton } from "./csv-button";
import { loadServiceDashRows } from "./load-dashboard";
import {
  parseServiceDashParams,
  reportsHref,
  scopeLabel,
  scopeOf,
  serviceDashHref,
  withPeriod,
  withScope,
  withYear,
} from "./params";
import { RankingCard } from "./ranking-card";
import { RegionMap } from "./region-map";
import { TripsChart } from "./trips-chart";

const n = (v: number) => v.toLocaleString("ko-KR");
const activeChip =
  "border-primary bg-primary text-primary-foreground hover:bg-primary";

function Kpi({
  label,
  tag,
  value,
  sub,
  accent,
}: {
  label: string;
  tag?: string;
  value: React.ReactNode;
  sub: string;
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

export async function ServiceDashboardScreen({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  const { canView, canEdit } = serviceAbilities(user);
  if (!canView) return <Forbidden user={user} />;

  const kst = new Date((await getNow()).getTime() + 9 * 3600_000);
  const thisYear = kst.getUTCFullYear();
  const p = parseServiceDashParams(searchParams, thisYear);
  const { rows, noTripDate, partPrices } = await loadServiceDashRows();
  const summary = serviceSummary(rows, p.year);
  const scope = scopeOf(p);
  const b = serviceBreakdown(rows, scope, partPrices);
  const years = yearsAvailable(rows, thisYear);

  const periodLabel = p.quarter
    ? `${p.year}년 ${p.quarter}분기`
    : `${p.year}년`;
  const tag = p.quarter ? `${p.quarter}분기` : "연간";
  const kpi: Summary = p.quarter
    ? summary.quarters[p.quarter - 1]
    : summary.annual;

  const chartRows =
    p.unit === "quarter"
      ? summary.quarters.map((r) => ({
          label: `${r.quarter}분기`,
          quarter: r.quarter,
          paid: r.paid,
          free: r.free,
          billingUnset: r.billingUnset,
          href: reportsHref(p.year, { quarter: r.quarter }),
        }))
      : summary.months.map((r) => ({
          label: `${r.month}월`,
          quarter: Math.ceil(r.month / 3),
          paid: r.paid,
          free: r.free,
          billingUnset: r.billingUnset,
          href: reportsHref(p.year, { month: r.month }),
        }));

  const billingTotal = b.billing.paid + b.billing.free + b.billing.billingUnset;
  const share = (v: number) => (billingTotal ? (v / billingTotal) * 100 : 0);
  const hrefOf = Object.fromEntries(
    [...b.region.bySigungu, ...b.region.byRegionOnly].map((r) => [
      r.label,
      reportsHref(p.year, scope, {
        region: r.sido,
        sigungu: r.sigungu ?? "none",
      }),
    ]),
  );

  const tableRows =
    p.tab === "month"
      ? summary.months.map((m) => ({ label: `${m.month}월`, ...m }))
      : p.tab === "quarter"
        ? summary.quarters.map((q) => ({ label: `${q.quarter}분기`, ...q }))
        : [{ label: `${p.year}년`, ...summary.annual }];
  const csvRows = [
    ...summary.months.map((m) => ({ label: `${m.month}월`, ...m })),
    ...summary.quarters.map((q) => ({ label: `${q.quarter}분기`, ...q })),
    { label: `${p.year}년 연간`, ...summary.annual },
  ].map((r) => ({
    ...r,
    paidRatio: r.paidRatio === null ? "" : pct1(r.paidRatio).toFixed(1),
  }));

  const priceText = (r: (typeof b.byPart)[number]) =>
    r.isOther
      ? "-"
      : !r.priceSites
        ? "미입력"
        : r.priceMin === r.priceMax
          ? won(r.priceMin)
          : `${won(r.priceMin)} ~ ${won(r.priceMax)} (${r.priceSites}곳)`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className={pageTitleClass}>서비스팀 대시보드</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <NavSelect
            label="연도"
            value={String(p.year)}
            options={years.map((y) => ({
              value: String(y),
              label: `${y}년`,
              href: serviceDashHref(p, withYear(y)),
            }))}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
          />
          <div role="group" aria-label="기간" className="flex gap-1">
            {[0, 1, 2, 3, 4].map((q) => (
              <Link
                key={q}
                href={serviceDashHref(p, withPeriod(q))}
                aria-current={p.quarter === q ? "true" : undefined}
                className={cn(chipClass, p.quarter === q && activeChip)}
              >
                {q ? `${q}분기` : "연간"}
              </Link>
            ))}
          </div>
          <ServiceCsvButton
            fileName={`서비스팀_실적_${p.year}.csv`}
            rows={csvRows}
          />
          {canEdit ? (
            <Link href="/service/reports/new" className={buttonPrimaryClass}>
              출장보고서 입력
            </Link>
          ) : (
            <span
              aria-disabled
              title="열람 전용 — 입력은 팀장만"
              className={cn(
                buttonPrimaryClass,
                "pointer-events-none opacity-50",
              )}
            >
              출장보고서 입력
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        출장 시작일 기준 · 출장보고서 1건 = 출장 1건
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label={`${periodLabel} 출장 건수`}
          value={n(kpi.trips)}
          sub="출장 시작일 기준"
          accent
        />
        <Kpi
          label="유상 비율"
          tag={tag}
          value={pct(kpi.paidRatio)}
          sub="유상 ÷ (유상 + 무상)"
        />
        <Kpi
          label="유상 / 무상"
          tag={tag}
          value={`${n(kpi.paid)} / ${n(kpi.free)}`}
          sub="건"
        />
        <Kpi
          label="수리 제품"
          tag={tag}
          value={n(kpi.productQty)}
          sub="대 (수량이 입력된 제품)"
        />
      </div>

      {(kpi.billingUnset > 0 || noTripDate > 0) && (
        <p
          role="status"
          className="flex flex-wrap gap-3 rounded-lg bg-warning-soft px-4 py-2 text-sm text-warning-strong"
        >
          {kpi.billingUnset > 0 && (
            <Link
              href={reportsHref(
                p.year,
                p.quarter ? { quarter: p.quarter } : {},
                { billing: "none" },
              )}
              className="hover:underline"
            >
              ⚠ {periodLabel} 비용청구 유무 미입력 {kpi.billingUnset}건 — 유상
              비율에서 제외
            </Link>
          )}
          {noTripDate > 0 && (
            <Link
              href="/service/reports?trip_date=none"
              className="hover:underline"
            >
              ⚠ 출장 시작일 없음 {noTripDate}건(전체 기간) — 출장 건수에서 제외
            </Link>
          )}
          <Link href="/service/reports" className="ml-auto hover:underline">
            출장보고서에서 입력 →
          </Link>
        </p>
      )}

      <section className="rounded-card border bg-card p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className={cardTitleClass}>
            {p.year}년 {p.unit === "month" ? "월별" : "분기별"} 출장 건수
          </h3>
          {p.quarter > 0 && (
            <span className="text-xs text-muted-foreground">
              {p.quarter}분기 강조
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            · 막대를 누르면 그 기간 출장보고서
          </span>
          <div
            role="group"
            aria-label="그래프 단위"
            className="ml-auto flex gap-1"
          >
            {(["month", "quarter"] as const).map((u) => (
              <Link
                key={u}
                href={serviceDashHref(p, { unit: u })}
                className={cn(chipClass, p.unit === u && activeChip)}
              >
                {u === "month" ? "월별" : "분기별"}
              </Link>
            ))}
          </div>
        </div>
        <TripsChart
          rows={chartRows}
          highlight={p.quarter}
          empty={summary.annual.trips === 0}
        />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <h3 className={cardTitleClass}>기간별 현황</h3>
        <NavSelect
          label="현황 기간"
          value={p.scope}
          options={[
            { value: "year", label: `${p.year}년 전체` },
            ...[1, 2, 3, 4].map((q) => ({ value: `q${q}`, label: `${q}분기` })),
            ...Array.from({ length: 12 }, (_, i) => ({
              value: `m${i + 1}`,
              label: `${i + 1}월`,
            })),
          ].map((o) => ({
            ...o,
            href: serviceDashHref(p, withScope(o.value)),
          }))}
          className="ml-2 h-8 w-36 rounded-md border border-input bg-background px-2 text-sm"
        />
        <span className="text-xs text-muted-foreground">{scopeLabel(p)}</span>
      </div>

      <section className="rounded-card border bg-card p-6">
        <h3 className={cn(cardTitleClass, "mb-1")}>지역별 출장 현황</h3>
        <RegionMap
          bySigungu={b.region.bySigungu}
          byRegionOnly={b.region.byRegionOnly}
          total={b.region.total}
          unassigned={b.region.unassigned}
          unassignedRatio={b.region.unassignedRatio}
          hrefOf={hrefOf}
          unassignedHref={reportsHref(p.year, scope, { region: "none" })}
          baseDate={BASE_DATE}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <section className="min-w-0 rounded-card border bg-card p-5">
          <h3 className={cardTitleClass}>유·무상 비율</h3>
          {billingTotal ? (
            <>
              <div
                role="img"
                aria-label={`유상 ${b.billing.paid}건, 무상 ${b.billing.free}건, 미입력 ${b.billing.billingUnset}건`}
                className="mt-4 flex h-6 overflow-hidden rounded-md"
              >
                {(
                  [
                    [b.billing.paid, BILLING_COLORS.paid, "PAID"],
                    [b.billing.free, BILLING_COLORS.free, "FREE"],
                    [b.billing.billingUnset, BILLING_COLORS.unset, "none"],
                  ] as const
                ).map(([v, color, key]) =>
                  v ? (
                    <Link
                      key={key}
                      href={reportsHref(p.year, scope, { billing: key })}
                      style={{ width: `${share(v)}%`, background: color }}
                      title={`${v}건 — 누르면 목록`}
                    />
                  ) : null,
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                {(
                  [
                    ["유상", b.billing.paid, BILLING_COLORS.paid],
                    ["무상", b.billing.free, BILLING_COLORS.free],
                    ["미입력", b.billing.billingUnset, BILLING_COLORS.unset],
                  ] as const
                ).map(([label, v, color]) => (
                  <span key={label} className="inline-flex items-center gap-1">
                    <i
                      className="inline-block size-2.5 rounded-sm"
                      style={{ background: color }}
                    />
                    {label} <strong>{v}</strong>건
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm">
                유상 비율{" "}
                <strong className="text-xl tabular-nums">
                  {pct(b.billing.paidRatio)}
                </strong>{" "}
                <span className="text-xs text-muted-foreground">
                  (미입력 제외)
                </span>
              </p>
            </>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              이 기간에 출장이 없습니다.
            </p>
          )}
        </section>
        <RankingCard
          title="교체 부품 순위"
          valueLabel="사용 보고서 수"
          columns={["수량 합(입력된 것)", "수량 미입력", "출장지별 단가(원)"]}
          rows={b.byPart.map((r) => ({
            label: r.label,
            value: r.reports,
            href: r.isOther
              ? undefined
              : `/service/prices/compare?part=${r.key}`,
            cells: [r.qty ?? 0, r.qtyMissing ?? 0, priceText(r)],
          }))}
          hint="부품을 사용한 출장보고서 수 기준(부품별 수량은 보고서에 없음). 출장지별 단가는 표 보기에서"
          empty="이 기간에 부품 사용 내역이 없습니다."
        />
        <RankingCard
          title="A/S 제품 모델 순위"
          valueLabel="수리 대수(수량 합)"
          columns={["보고서 수", "수량 미입력"]}
          rows={b.byModel.map((r) => ({
            label: r.label,
            value: r.qty ?? 0,
            href: r.isOther
              ? undefined
              : reportsHref(p.year, scope, { model: r.key! }),
            cells: [r.reports, r.qtyMissing ?? 0],
          }))}
          hint="제품 목록의 수량 합계 기준"
          empty="이 기간에 제품 정보가 없습니다."
        />
        <RankingCard
          title="출장 담당자 순위"
          valueLabel="출장 횟수"
          columns={[]}
          rows={b.byPerson.map((r) => ({
            label: r.label,
            value: r.reports,
            href: r.isOther
              ? undefined
              : reportsHref(p.year, scope, { person: r.key! }),
            cells: [],
          }))}
          hint="작성자 + 동행자, 출장 1건에 1명당 1회"
          empty="이 기간에 출장이 없습니다."
        />
      </div>

      <section className="rounded-card border bg-card py-5">
        <div className="flex items-center px-6">
          <h3 className={cardTitleClass}>서비스팀 실적 표</h3>
          <div className="ml-auto flex gap-1">
            {(
              [
                ["month", "월별"],
                ["quarter", "분기별"],
                ["year", "연간"],
              ] as const
            ).map(([t, label]) => (
              <Link
                key={t}
                href={serviceDashHref(p, { tab: t })}
                className={cn(chipClass, p.tab === t && activeChip)}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-y bg-muted text-xs text-muted-foreground">
                {[
                  "기간",
                  "출장 건수",
                  "유상",
                  "무상",
                  "미입력",
                  "유상 비율",
                  "수리 제품(대)",
                  "부품 사용 보고서",
                ].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "px-3 py-2 font-medium",
                      i ? "text-right" : "text-left",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.label} className="border-b last:border-0">
                  <td className="px-3 py-1.5">{r.label}</td>
                  {[r.trips, r.paid, r.free, r.billingUnset].map((v, i) => (
                    <td key={i} className="px-3 py-1.5 text-right tabular-nums">
                      {n(v)}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {pct(r.paidRatio)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {n(r.productQty)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {n(r.reportsWithParts)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
