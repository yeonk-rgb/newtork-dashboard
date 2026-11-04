"use client";
// 출장지 비교 분석 — 친구 저장소 PriceCompareView 그대로
// ① 부품 하나의 출장지별 가격(평균선, 최고·최저) ② 출장지별 평균 부품 단가 — '공통 부품만'(고른 출장지 모두에 가격이 있는 부품) / 전체
import { Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/shared/lib/utils";
import {
  buttonSecondaryClass,
  cardTitleClass,
  chipClass,
  pillClass,
} from "@/shared/ui/styles";

import { won } from "../labels";
import { compare, diffPct, signedPct } from "./compute";
import { downloadCsv } from "./csv";
import type { PriceData } from "./load-prices";
import { PriceBarChart } from "./price-bar-chart";
import { Kpi } from "./price-manage";

const field = "h-9 rounded-lg border border-input bg-background px-2 text-sm";
const activeChip =
  "border-primary bg-primary text-primary-foreground hover:bg-primary";

export function PriceCompare({
  data,
  partId,
}: {
  data: PriceData;
  partId: string | null;
}) {
  const router = useRouter();
  const { sites, parts, prices } = data;
  const [partSearch, setPartSearch] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [commonOnly, setCommonOnly] = useState(true);
  const part = parts.find((p) => p.id === partId) ?? null;
  const k = partSearch.trim().toLowerCase();
  const partOptions = k
    ? parts.filter((p) => p.name.toLowerCase().includes(k))
    : parts;
  const c = compare(prices, sites, partId, excluded, commonOnly);
  const toggle = (id: string) => {
    const next = new Set(excluded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExcluded(next);
  };

  const exportCsv = () =>
    part &&
    downloadCsv(
      `출장지_비교_${part.name}.csv`,
      [
        { label: "부품", value: () => part.name },
        { label: "출장지", value: (r) => r.label },
        { label: "단가(원)", value: (r) => r.value },
        {
          label: "평균 대비(%)",
          value: (r) => diffPct(r.value, c.partAvg) ?? "",
        },
        { label: "메모", value: (r) => r.note },
      ],
      c.partRows,
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          value={partSearch}
          onChange={(e) => setPartSearch(e.target.value)}
          placeholder="부품 검색"
          aria-label="부품 검색"
          className={cn(field, "w-40")}
        />
        <select
          value={partId ?? ""}
          onChange={(e) =>
            router.replace(`/service/prices/compare?part=${e.target.value}`)
          }
          aria-label="비교할 부품"
          className={cn(field, "min-w-52")}
        >
          {partOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!c.partRows.length}
          onClick={exportCsv}
          className={buttonSecondaryClass}
        >
          <Download className="size-4" aria-hidden />
          비교 표 다운로드
        </button>
      </div>

      <section className="rounded-card border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">
            비교할 출장지 {c.selected.length}/{sites.length}
          </span>
          <button
            type="button"
            onClick={() => setExcluded(new Set())}
            className="text-primary hover:underline"
          >
            모두
          </button>
          <button
            type="button"
            onClick={() => setExcluded(new Set(sites.map((s) => s.id)))}
            className="text-primary hover:underline"
          >
            해제
          </button>
        </div>
        <div
          role="group"
          aria-label="비교할 출장지"
          className="mt-2 flex flex-wrap gap-1"
        >
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={!excluded.has(s.id)}
              onClick={() => toggle(s.id)}
              className={cn(chipClass, !excluded.has(s.id) && activeChip)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </section>

      {part && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              label={`${part.name} 평균`}
              value={won(c.partAvg)}
              sub={`가격 있는 출장지 ${c.partRows.length}곳`}
            />
            <Kpi
              label="최저"
              value={won(c.partMin?.value)}
              sub={c.partMin?.label ?? "-"}
            />
            <Kpi
              label="최고"
              value={won(c.partMax?.value)}
              sub={c.partMax?.label ?? "-"}
            />
            <Kpi
              label="최고 − 최저"
              value={
                c.partRows.length > 1
                  ? won(c.partMax!.value - c.partMin!.value)
                  : "-"
              }
              sub={
                c.partRows.length > 1
                  ? `최저 대비 ${signedPct(diffPct(c.partMax!.value, c.partMin!.value))}`
                  : "출장지 2곳 이상일 때"
              }
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-[7fr_5fr]">
            <section className="min-w-0 rounded-card border bg-card p-6">
              <h2 className={cn(cardTitleClass, "mb-2")}>
                {part.name} · 출장지별 가격
              </h2>
              {c.partRows.length ? (
                <PriceBarChart
                  rows={c.partRows}
                  refValue={c.partRows.length > 1 ? c.partAvg : null}
                  ariaLabel={`${part.name} 출장지별 가격 막대그래프`}
                />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  고른 출장지에 이 부품 가격이 없습니다.{" "}
                  <Link
                    href={`/service/prices?part=${part.id}`}
                    className="text-primary hover:underline"
                  >
                    부품 가격 관리
                  </Link>
                  에서 입력하세요.
                </p>
              )}
            </section>
            <section className="min-w-0 rounded-card border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">
                        출장지
                      </th>
                      <th className="px-3 py-2 text-right font-medium">단가</th>
                      <th className="px-3 py-2 text-right font-medium">
                        평균 대비
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.partRows.map((r) => (
                      <tr key={r.label} className="border-b">
                        <td className="px-3 py-1.5 font-semibold">
                          {r.label}{" "}
                          {c.partRows.length > 1 && r === c.partMax && (
                            <span
                              className={cn(
                                pillClass,
                                "ml-1 bg-danger-soft text-danger-strong",
                              )}
                            >
                              최고
                            </span>
                          )}
                          {c.partRows.length > 1 && r === c.partMin && (
                            <span
                              className={cn(
                                pillClass,
                                "ml-1 bg-primary-50 text-primary",
                              )}
                            >
                              최저
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {won(r.value)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {signedPct(diffPct(r.value, c.partAvg))}
                        </td>
                      </tr>
                    ))}
                    {c.missingSites.map((s) => (
                      <tr key={s.id} className="border-b text-muted-foreground">
                        <td className="px-3 py-1.5">{s.name}</td>
                        <td className="px-3 py-1.5 text-right">미입력</td>
                        <td className="px-3 py-1.5 text-right">-</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <h2 className={cardTitleClass}>출장지별 평균 부품 단가</h2>
        <div
          role="group"
          aria-label="평균 계산 범위"
          className="ml-auto flex gap-1"
        >
          <button
            type="button"
            aria-pressed={commonOnly}
            onClick={() => setCommonOnly(true)}
            className={cn(chipClass, commonOnly && activeChip)}
          >
            공통 부품만
          </button>
          <button
            type="button"
            aria-pressed={!commonOnly}
            onClick={() => setCommonOnly(false)}
            className={cn(chipClass, !commonOnly && activeChip)}
          >
            등록된 부품 전체
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {c.useCommon ? (
          `고른 출장지 모두에 가격이 있는 부품 ${c.commonParts.size}개만으로 평균을 냅니다(같은 부품끼리 비교).`
        ) : commonOnly ? (
          <>
            <span className="text-warning-strong">
              ⚠ 고른 출장지 모두에 가격이 있는 부품이 없어 등록된 부품 전체로
              계산했습니다.
            </span>{" "}
            출장지를 줄이면 공통 부품끼리 비교할 수 있습니다.
          </>
        ) : (
          "출장지마다 가격이 등록된 부품이 달라 평균을 그대로 비교하면 차이가 부품 구성 때문일 수 있습니다."
        )}
      </p>
      <div className="grid gap-4 xl:grid-cols-[7fr_5fr]">
        <section className="min-w-0 rounded-card border bg-card p-6">
          {c.siteAvgRows.length ? (
            <PriceBarChart
              rows={c.siteAvgRows}
              refValue={c.siteAvgRows.length > 1 ? c.overallAvg : null}
              refLabel="출장지 평균"
              ariaLabel="출장지별 평균 부품 단가 막대그래프"
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              고른 출장지에 등록된 가격이 없습니다.
            </p>
          )}
        </section>
        <section className="min-w-0 rounded-card border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">출장지</th>
                  <th className="px-3 py-2 text-right font-medium">
                    평균 단가
                  </th>
                  <th className="px-3 py-2 text-right font-medium">부품 수</th>
                  <th className="px-3 py-2 text-right font-medium">
                    평균 대비
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.siteAvgRows.map((r) => (
                  <tr key={r.label} className="border-b">
                    <td className="px-3 py-1.5 font-semibold">{r.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {won(r.value)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.parts}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {signedPct(diffPct(r.value, c.overallAvg))}
                    </td>
                  </tr>
                ))}
                {!c.siteAvgRows.length && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-3 text-center text-xs text-muted-foreground"
                    >
                      -
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
