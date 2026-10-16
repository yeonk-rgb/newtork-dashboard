// 메인 원형 그래프 3개: 연간 목표 도넛 / 산업분야별 매출 비중 / 제품 시리즈별 매출 비중
import "server-only";

import { INDUSTRIES } from "@/shared/contracts/production";
import { serializeBigInt } from "@/shared/format/bigint";
import { INDUSTRY_COLORS, SERIES_COLORS } from "@/shared/ui/chart-colors";

import { alignMockToTotal } from "../../external/align-mock";
import {
  getSalesShareByIndustry,
  getSalesShareBySeries,
} from "../../external/production-mock";
import type { ManagementSummary } from "../../metrics/types";
import { ShareDonut } from "./share-donut";
import { TargetDonut } from "./target-donut";

const SAMPLE_BADGE = "샘플 데이터";

export async function DashboardDonuts({
  summary,
}: {
  summary: ManagementSummary;
}) {
  const [rawIndustry, rawSeries] = await Promise.all([
    getSalesShareByIndustry(summary.period),
    getSalesShareBySeries(summary.period),
  ]);
  // 목업이면 합계를 이 기간 확정 총매출에 맞춘다 (비중만 가상) — 통합 후 실제 데이터면 그대로
  const revenue = summary.revenue.total;
  const industry = alignMockToTotal(rawIndustry, revenue);
  const series = alignMockToTotal(rawSeries, revenue);
  const mockProps = (source: "mock" | "production") =>
    source === "mock"
      ? {
          badge: SAMPLE_BADGE,
          note: "합계는 이 기간 확정 매출, 비중은 가상(생산팀 데이터 연동 전)",
          emptyText: "이 기간에 확정된 데이터가 없습니다.",
        }
      : {};

  return (
    <section
      aria-label="원형 그래프"
      className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      <TargetDonut
        year={summary.period.year}
        progress={summary.annualProgress}
      />
      <ShareDonut
        title={`${summary.label} 산업분야별 매출 비중`}
        {...mockProps(industry.source)}
        items={serializeBigInt(industry.items)}
        order={INDUSTRIES.map((i) => i.key)}
        colors={INDUSTRY_COLORS}
      />
      <ShareDonut
        title={`${summary.label} 제품 시리즈별 매출 비중`}
        {...mockProps(series.source)}
        items={serializeBigInt(series.items)}
        order={Object.keys(SERIES_COLORS)}
        colors={SERIES_COLORS}
      />
    </section>
  );
}
