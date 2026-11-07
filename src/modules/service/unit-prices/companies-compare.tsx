"use client";
// 출장지별 비교 — 친구 우민영 저장소 part-prices.js renderCompanies 를 옮김
// 출장지마다 뉴토크 기준값 대비 평균 차이율 막대 → 막대·줄을 누르면 그 출장지의 부품별 차이. 주소 ?category=&company=
import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@/shared/lib/utils";
import {
  buttonCompactClass,
  buttonSecondaryClass,
  cardTitleClass,
  pillClass,
} from "@/shared/ui/styles";

import {
  LOW_ALERT_RATE,
  signedRate,
  signedWon,
  type CompanyRow,
} from "./compute";
import { DiffBarChart, DiffLegend } from "./diff-bar-chart";

const wonText = (v: number) => `${v.toLocaleString("ko-KR")}원`;

export function CompaniesCompare({
  companies,
  lowCount,
  categories,
  category,
  selected,
}: {
  companies: CompanyRow[];
  lowCount: number;
  categories: string[];
  category: string;
  selected: string | null;
}) {
  const router = useRouter();
  const href = (company: string | null) => {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (company) p.set("company", company);
    return `?${p}`;
  };
  const toggle = (company: string) =>
    router.push(
      `${href(selected === company ? null : company)}${selected === company ? "" : "#company-detail"}`,
      { scroll: false },
    );
  const current = companies.find((c) => c.company === selected) ?? null;
  const exportUrl = (format: "xlsx" | "csv") =>
    `/api/service/unit-prices/export?${new URLSearchParams({
      kind: "companies",
      category,
      format,
    })}`;

  return (
    <div className="space-y-4">
      <section className="rounded-card border bg-card p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={cardTitleClass}>출장지별 단가 비교</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              뉴토크 기준값 대비 평균 차이율
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form method="get" className="flex items-center gap-2">
              <select
                name="category"
                defaultValue={category}
                aria-label="분류"
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">모든 분류</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button type="submit" className={buttonSecondaryClass}>
                보기
              </button>
            </form>
            <a
              href={exportUrl("xlsx")}
              className={cn(
                buttonCompactClass,
                !companies.length && "pointer-events-none opacity-50",
              )}
            >
              ⬇ 엑셀
            </a>
            <a
              href={exportUrl("csv")}
              title="부품별 차이 CSV (출장지 열 포함) — 출장지 요약은 엑셀에"
              className={cn(
                buttonCompactClass,
                !companies.length && "pointer-events-none opacity-50",
              )}
            >
              ⬇ CSV
            </a>
          </div>
        </div>

        {companies.length === 0 ? (
          <p className="rounded-lg bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">
            비교할 출장지 단가가 없습니다. [단가 데이터 업로드]에서 출장지별
            단가 CSV를 올리면 쌓입니다. (뉴토크 기준값이 없는 부품은 비교에서
            빠집니다)
          </p>
        ) : (
          <div className="space-y-3">
            {lowCount > 0 && (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm">
                <span
                  className={cn(
                    pillClass,
                    "mr-1 bg-danger-soft text-danger-strong",
                  )}
                >
                  크게 낮음
                </span>
                뉴토크 기준값보다 <b>{LOW_ALERT_RATE}% 이상 낮은</b> 단가가{" "}
                <b>{lowCount}건</b> 있습니다. 출장지를 눌러 어떤 부품인지
                확인하세요.
              </p>
            )}
            <DiffLegend />
            <DiffBarChart
              rows={companies.map((c) => ({
                key: c.company,
                label: c.company,
                rate: c.averageRate,
                detail: `부품 ${c.count}개 평균 (비쌈 ${c.above} · 쌈 ${c.below})`,
              }))}
              ariaLabel="출장지별 뉴토크 기준값 대비 평균 차이율"
              selected={selected}
              onSelect={toggle}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">출장지(업체)</th>
                    <th className="px-3 py-2 text-right font-medium">
                      비교 부품
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      평균 차이율
                    </th>
                    <th className="px-3 py-2 text-right font-medium">최저</th>
                    <th className="px-3 py-2 text-right font-medium">최고</th>
                    <th className="px-3 py-2 text-right font-medium">
                      비쌈 · 쌈
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      크게 낮음
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr
                      key={c.company}
                      onClick={() => toggle(c.company)}
                      className={cn(
                        "cursor-pointer border-b align-middle last:border-0 hover:bg-primary-50/40",
                        selected === c.company && "bg-primary-50/60",
                      )}
                    >
                      <td className="px-3 py-2 font-semibold">
                        <Link
                          href={href(c.company)}
                          scroll={false}
                          onClick={(e) => e.preventDefault()}
                          className="text-primary hover:underline"
                        >
                          {c.company}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {c.count}개
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {signedRate(c.averageRate)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {signedRate(c.minRate)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {signedRate(c.maxRate)}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                        {c.above} · {c.below}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {c.low ? (
                          <span
                            className={cn(
                              pillClass,
                              "bg-danger-soft text-danger-strong",
                            )}
                          >
                            {c.low}건
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              차이율 = (출장지 단가 − 뉴토크 기준값) ÷ 뉴토크 기준값. 부품마다
              그 출장지의 가장 최근 단가 1개만 쓰고, 평균은 부품마다 같은 무게로
              계산합니다. 기준값이 없는 부품은 빠집니다.
            </p>
          </div>
        )}
      </section>

      {current && (
        <section
          id="company-detail"
          className="scroll-mt-4 rounded-card border bg-card p-6"
        >
          <h2 className={cardTitleClass}>{current.company}</h2>
          <p className="mt-1 mb-4 text-xs text-muted-foreground">
            부품 {current.count}개, 평균 {signedRate(current.averageRate)}
          </p>
          <DiffLegend />
          <DiffBarChart
            rows={current.parts.map((p) => ({
              key: p.itemId,
              label: `${p.partNo} ${p.name}`,
              rate: p.diffRate,
              detail: `${wonText(p.unitPrice)} (기준값 ${wonText(p.basePrice)})${p.low ? " · 크게 낮음" : ""}`,
            }))}
            ariaLabel={`${current.company} 부품별 뉴토크 기준값 대비 차이율`}
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">파트넘버</th>
                  <th className="px-3 py-2 font-medium">품목</th>
                  <th className="px-3 py-2 text-right font-medium">
                    뉴토크 기준값
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    출장지 단가
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    기준값 대비
                  </th>
                  <th className="px-3 py-2 font-medium">적용 시작일</th>
                </tr>
              </thead>
              <tbody>
                {current.parts.map((p) => (
                  <tr key={p.itemId} className="border-b last:border-0">
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">
                      <Link
                        href={`/service/unit-prices?part=${p.itemId}#part-detail`}
                        className="text-primary hover:underline"
                        title="부품별 비교에서 이 부품 열기"
                      >
                        {p.partNo}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {wonText(p.basePrice)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {wonText(p.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                      {signedWon(p.diff)}{" "}
                      <span className="text-muted-foreground">
                        ({signedRate(p.diffRate)})
                      </span>
                      {p.low && (
                        <span
                          className={cn(
                            pillClass,
                            "ml-1 bg-danger-soft text-danger-strong",
                          )}
                        >
                          크게 낮음
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {p.effectiveDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
