"use client";
// 지역별 출장 버블 지도 — 친구 저장소 RegionBubbleMap.vue 규칙 그대로 (Chart.js 대신 SVG, 같은 경계 자료·메르카토르 투영)
// - 버블 면적 ∝ 출장 건수 (반지름 = 30 × √(건수 ÷ 기준 최댓값), 기준 최댓값은 최소 10건)
// - 시·군·구 미확인(시·도만 앎)은 시·도 대표점에 속이 빈 원, 미지정은 목록에만
// - 비율 = 지역 건수 ÷ 선택 기간 전체 출장 건수(미지정 포함). 상위 5개는 지도에 이름 직접 표시
// - 버블·목록을 누르면 그 지역·기간 출장보고서 목록으로
// 지도: 통계청 SGIS 행정동 경계(공공누리 제1유형) 가공 vuski/admdongkor(CC BY 4.0), 2026-10-01 기준
import Link from "next/link";
import { useState } from "react";

import { PALETTE } from "@/shared/ui/chart-colors";

import { pct } from "../labels";
import type { RegionPoint } from "../metrics/dashboard";
import map from "./korea-map.json";
import { MAP_FRAME, project } from "./projection";

const LABEL_TOP = 5;
const MAX_RADIUS = 30;
const MIN_SCALE_MAX = 10;

const n = (v: number) => v.toLocaleString("ko-KR");
const cmp = (a: string, b: string) => a.localeCompare(b, "ko");

type Point = RegionPoint & {
  kind: "sigungu" | "region";
  href: string;
  x: number;
  y: number;
};

export function RegionMap({
  bySigungu,
  byRegionOnly,
  total,
  unassigned,
  unassignedRatio,
  hrefOf,
  unassignedHref,
  baseDate,
}: {
  bySigungu: RegionPoint[];
  byRegionOnly: RegionPoint[];
  total: number;
  unassigned: number;
  unassignedRatio: number | null;
  /** 지역 → 출장보고서 목록 주소 */
  hrefOf: Record<string, string>;
  unassignedHref: string;
  baseDate: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const points: Point[] = [
    ...bySigungu.map((r) => ({ ...r, kind: "sigungu" as const })),
    ...byRegionOnly.map((r) => ({ ...r, kind: "region" as const })),
  ]
    .map((r) => ({
      ...r,
      href: hrefOf[r.label],
      ...project(map.fit, r.lon, r.lat),
    }))
    .sort((a, b) => b.trips - a.trips); // 큰 버블을 먼저 그려 작은 버블이 위에
  const ranked = [...points].sort(
    (a, b) => b.trips - a.trips || cmp(a.label, b.label),
  );
  const scaleMax = Math.max(MIN_SCALE_MAX, ...points.map((p) => p.trips));
  const radiusOf = (v: number) => MAX_RADIUS * Math.sqrt(v / scaleMax);
  const legend = [...new Set([1, Math.round(scaleMax / 2), scaleMax])].filter(
    (v) => v >= 1,
  );

  // 이름표: 순위대로 오른쪽 → 왼쪽 → 위 → 아래, 앞 이름표·다른 버블과 겹치면 다음 자리, 둘 곳 없으면 생략(목록에서 확인)
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const hit = (
    a: { x: number; y: number; w: number; h: number },
    b: typeof a,
  ) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const circles = points.map((p) => {
    const r = radiusOf(p.trips);
    return { x: p.x - r, y: p.y - r, w: r * 2, h: r * 2, p };
  });
  const labels = ranked.slice(0, LABEL_TOP).flatMap((p) => {
    const r = radiusOf(p.trips);
    const text = `${p.short} ${n(p.trips)}건·${pct(p.ratio)}`;
    const w = text.length * 7.2;
    const h = 14;
    const candidates = [
      { x: p.x + r + 4, y: p.y - h / 2 },
      { x: p.x - r - 4 - w, y: p.y - h / 2 },
      { x: p.x - w / 2, y: p.y - r - 4 - h },
      { x: p.x - w / 2, y: p.y + r + 4 },
    ].map((c) => ({ ...c, w, h }));
    const box = candidates.find(
      (c) =>
        c.x >= 0 &&
        c.x + w <= MAP_FRAME.width + 70 &&
        c.y >= 0 &&
        ![...placed, ...circles.filter((q) => q.p !== p)].some((q) =>
          hit(c, q),
        ),
    );
    if (!box) return [];
    placed.push(box);
    return [{ text, x: box.x, y: box.y + h / 2 }];
  });

  return (
    <div>
      <div className="mb-1 flex items-center">
        <p className="m-0 text-xs text-muted-foreground">
          출장지 주소의 시·도 + 시·군·구 기준 · 원 크기 = 출장 건수 · 비율 =
          전체 {n(total)}건 대비
        </p>
        <button
          type="button"
          onClick={() => setAsTable(!asTable)}
          className="ml-auto text-xs text-primary hover:underline"
        >
          {asTable ? "지도로 보기" : "표로 보기"}
        </button>
      </div>
      {asTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1.5 font-medium">지역</th>
              <th className="py-1.5 text-right font-medium">출장 건수</th>
              <th className="py-1.5 text-right font-medium">전체 대비</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p) => (
              <tr key={p.label} className="border-b">
                <td className="py-1.5">
                  <Link
                    href={p.href}
                    className="hover:text-primary hover:underline"
                  >
                    {p.label}
                  </Link>
                </td>
                <td className="py-1.5 text-right tabular-nums">{n(p.trips)}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {pct(p.ratio)}
                </td>
              </tr>
            ))}
            <tr className="border-b">
              <td className="py-1.5">
                <Link
                  href={unassignedHref}
                  className="hover:text-primary hover:underline"
                >
                  미지정
                </Link>
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {n(unassigned)}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {pct(unassignedRatio)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th className="py-1.5 text-left">합계</th>
              <th className="py-1.5 text-right tabular-nums">{n(total)}</th>
              <th className="py-1.5 text-right">{total ? "100%" : "-"}</th>
            </tr>
          </tfoot>
        </table>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,1fr)]">
          <div>
            <div className="relative">
              <svg
                viewBox={`0 0 ${MAP_FRAME.width + 70} ${MAP_FRAME.height}`}
                className="h-[470px] w-full"
                role="img"
                aria-label="지역별 출장 버블 지도"
              >
                {map.paths.map((s) => (
                  <path
                    key={s.name}
                    d={s.d}
                    fill="#eef1f5"
                    stroke="#c3c2b7"
                    strokeWidth={0.8}
                  >
                    <title>{s.name}</title>
                  </path>
                ))}
                {points.map((p) => (
                  <Link key={p.label} href={p.href}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={Math.max(radiusOf(p.trips), 3)}
                      fill={
                        p.kind === "region"
                          ? "rgba(255,255,255,0.9)"
                          : "rgba(31,58,95,0.72)"
                      }
                      stroke={p.kind === "region" ? PALETTE.navy : "#ffffff"}
                      strokeWidth={2}
                      className="cursor-pointer hover:opacity-80"
                    >
                      <title>
                        {`${p.label}\n출장 ${n(p.trips)}건\n전체 대비 ${pct(p.ratio)}${p.kind === "region" ? "\n시·군·구가 확인되지 않아 시·도 대표 위치에 표시" : ""}`}
                      </title>
                    </circle>
                  </Link>
                ))}
                {labels.map((l) => (
                  <text
                    key={l.text}
                    x={l.x}
                    y={l.y}
                    dominantBaseline="middle"
                    fontSize={12}
                    fontWeight={600}
                    fill="#0b0b0b"
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth={4}
                    paintOrder="stroke"
                    strokeLinejoin="round"
                    pointerEvents="none"
                  >
                    {l.text}
                  </text>
                ))}
              </svg>
              {points.length === 0 && (
                <p className="absolute inset-x-0 top-1/2 text-center text-sm text-muted-foreground">
                  지역이 확인된 출장이 없습니다
                </p>
              )}
            </div>
            {points.length > 0 && (
              <div
                aria-hidden
                className="mt-1 flex items-end gap-4 text-xs text-muted-foreground"
              >
                <span>원 크기 = 출장 건수</span>
                {legend.map((v) => (
                  <span key={v} className="inline-flex items-center gap-1">
                    <span
                      className="inline-block rounded-full border-2 border-white bg-primary/70"
                      style={{
                        width: radiusOf(v) * 2 * 0.76,
                        height: radiusOf(v) * 2 * 0.76,
                      }}
                    />
                    {v}건
                  </span>
                ))}
              </div>
            )}
          </div>
          <ol className="space-y-1 text-sm">
            {ranked.slice(0, 10).map((p, i) => (
              <li key={p.label}>
                <Link
                  href={p.href}
                  className="grid grid-cols-[1.25rem_0.75rem_1fr_auto_3.5rem] items-center gap-2 rounded px-1 py-0.5 hover:bg-primary-50"
                >
                  <span className="text-xs text-muted-foreground">{i + 1}</span>
                  <span
                    className={
                      p.kind === "region"
                        ? "size-2.5 rounded-full border-2 border-primary bg-card"
                        : "size-2.5 rounded-full bg-primary/70"
                    }
                  />
                  <span className="truncate" title={p.label}>
                    {p.label}
                  </span>
                  <span className="tabular-nums">{n(p.trips)}건</span>
                  <span className="text-right text-xs text-muted-foreground tabular-nums">
                    {pct(p.ratio)}
                  </span>
                </Link>
              </li>
            ))}
            {ranked.length > 10 && (
              <li className="px-1 text-xs text-muted-foreground">
                외 {ranked.length - 10}개 지역 — 표로 보기
              </li>
            )}
            <li>
              <Link
                href={unassignedHref}
                className="grid grid-cols-[1.25rem_0.75rem_1fr_auto_3.5rem] items-center gap-2 rounded border-t px-1 pt-1.5 hover:bg-primary-50"
              >
                <span />
                <span className="size-2.5 rounded-full bg-muted-foreground/40" />
                <span>
                  미지정{" "}
                  <span className="text-xs text-muted-foreground">
                    (주소 없음·판정 불가)
                  </span>
                </span>
                <span className="tabular-nums">{n(unassigned)}건</span>
                <span className="text-right text-xs text-muted-foreground tabular-nums">
                  {pct(unassignedRatio)}
                </span>
              </Link>
            </li>
          </ol>
        </div>
      )}
      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        지도: 통계청 통계지리정보서비스(SGIS) 행정동 경계(공공누리 제1유형)를
        가공한 vuski/admdongkor 자료(CC BY 4.0), {baseDate} 기준
      </p>
    </div>
  );
}
