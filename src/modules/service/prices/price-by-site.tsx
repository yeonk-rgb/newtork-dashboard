"use client";
// 출장지별 가격 조회 — 친구 저장소 PriceBySiteView 그대로: 출장지를 고르면 부품 단가(막대 + 표)와 전체 출장지 평균 대비. 고른 출장지는 주소 ?site=
import { Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/shared/lib/utils";
import { buttonSecondaryClass, cardTitleClass } from "@/shared/ui/styles";

import { won } from "../labels";
import { siteRows, signedPct } from "./compute";
import { downloadCsv } from "./csv";
import type { PriceData } from "./load-prices";
import { PriceBarChart } from "./price-bar-chart";
import { Kpi } from "./price-manage";

const field = "h-9 rounded-lg border border-input bg-background px-2 text-sm";

export function PriceBySite({
  data,
  siteId,
}: {
  data: PriceData;
  siteId: string | null;
}) {
  const router = useRouter();
  const { sites, parts, prices } = data;
  const [partSearch, setPartSearch] = useState("");
  const [showMissing, setShowMissing] = useState(true);
  const site = sites.find((s) => s.id === siteId) ?? null;
  const { rows, priced, siteAvg } = siteRows(prices, parts, siteId ?? "", {
    search: partSearch,
    showMissing,
  });
  const mine = new Map(
    prices.filter((p) => p.siteId === siteId).map((p) => [p.partId, p]),
  );

  const exportCsv = () =>
    site &&
    downloadCsv(
      `출장지별_부품가격_${site.name}.csv`,
      [
        { label: "출장지", value: () => site.name },
        { label: "부품", value: (r) => r.part.name },
        { label: "단가(원)", value: (r) => r.price ?? "" },
        {
          label: "전체 출장지 평균(원)",
          value: (r) => (r.avg === null ? "" : Math.round(r.avg)),
        },
        { label: "평균 대비(%)", value: (r) => r.diff ?? "" },
        { label: "메모", value: (r) => r.note },
      ],
      rows,
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          value={siteId ?? ""}
          onChange={(e) =>
            router.replace(`/service/prices/by-site?site=${e.target.value}`)
          }
          aria-label="출장지 선택"
          className={cn(field, "min-w-52")}
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.priceCount})
            </option>
          ))}
        </select>
        <input
          value={partSearch}
          onChange={(e) => setPartSearch(e.target.value)}
          placeholder="부품 검색"
          aria-label="부품 검색"
          className={cn(field, "w-44")}
        />
        <button
          type="button"
          disabled={!site}
          onClick={exportCsv}
          className={buttonSecondaryClass}
        >
          <Download className="size-4" aria-hidden />표 다운로드
        </button>
      </div>
      {!sites.length ? (
        <p className="rounded-card border bg-card p-5 text-sm text-muted-foreground">
          출장지가 없습니다.{" "}
          <Link href="/service/sites" className="text-primary hover:underline">
            출장지 관리
          </Link>
          에서 등록하세요.
        </p>
      ) : site ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Kpi
              label="출장지"
              value={<span className="text-xl">{site.name}</span>}
              sub={`${site.regionLabel} · 출장보고서 ${site.reportCount}건`}
            />
            <Kpi
              label="가격 등록 부품"
              value={
                <>
                  {priced.length}{" "}
                  <small className="text-base font-normal text-muted-foreground">
                    / {parts.length}개
                  </small>
                </>
              }
              sub="검색 조건 안"
            />
            <Kpi
              label="이 출장지 평균 단가"
              value={won(siteAvg)}
              sub="가격이 있는 부품만"
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="min-w-0 rounded-card border bg-card p-6">
              <h2 className={cn(cardTitleClass, "mb-2")}>
                {site.name} 부품 단가
              </h2>
              {priced.length ? (
                <PriceBarChart
                  rows={priced.map((r) => ({
                    label: r.part.name,
                    value: r.price!,
                  }))}
                  refValue={siteAvg}
                  refLabel="이 출장지 평균"
                  ariaLabel={`${site.name} 부품 단가 막대그래프`}
                />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  이 출장지에 등록된 부품 가격이 없습니다.{" "}
                  <Link
                    href="/service/prices"
                    className="text-primary hover:underline"
                  >
                    부품 가격 관리
                  </Link>
                  에서 입력하세요.
                </p>
              )}
            </section>
            <section className="min-w-0 rounded-card border bg-card">
              <div className="flex items-center px-6 pt-5 pb-3">
                <h2 className={cardTitleClass}>가격 목록</h2>
                <label className="ml-auto flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={showMissing}
                    onChange={(e) => setShowMissing(e.target.checked)}
                  />
                  미입력 부품도 보기
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y bg-muted text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">부품</th>
                      <th className="px-3 py-2 text-right font-medium">단가</th>
                      <th className="px-3 py-2 text-right font-medium">
                        전체 평균
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        평균 대비
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        메모·수정
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const cur = mine.get(r.part.id);
                      return (
                        <tr
                          key={r.part.id}
                          className={cn(
                            "border-b last:border-0",
                            r.price === null && "text-muted-foreground",
                          )}
                        >
                          <td className="px-3 py-1.5 font-semibold">
                            <Link
                              href={`/service/prices/compare?part=${r.part.id}`}
                              className="hover:text-primary hover:underline"
                            >
                              {r.part.name}
                            </Link>
                          </td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
                            {r.price === null ? "미입력" : won(r.price)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs whitespace-nowrap tabular-nums">
                            {won(r.avg)}
                            {r.avgSites > 0 && (
                              <span className="text-muted-foreground">
                                {" "}
                                ({r.avgSites}곳)
                              </span>
                            )}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-1.5 text-right tabular-nums",
                              r.diff !== null &&
                                r.diff > 0 &&
                                "text-danger-strong",
                              r.diff !== null && r.diff < 0 && "text-primary",
                            )}
                          >
                            {r.diff === null ? "-" : signedPct(r.diff)}
                          </td>
                          <td className="px-3 py-1.5 text-xs">
                            {r.note && <div>{r.note}</div>}
                            {cur && (
                              <div className="text-muted-foreground">
                                {cur.updatedBy} · {cur.updatedAtLabel}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-4 text-center text-xs text-muted-foreground"
                        >
                          조건에 맞는 부품이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="px-6 py-3 text-xs text-muted-foreground">
                전체 평균 = 가격이 등록된 모든 출장지의 평균(미입력 제외). 평균
                대비 = 이 출장지 단가가 평균보다 몇 % 높은지·낮은지.
              </p>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
