// 메인 원형 그래프 3개: 연간 목표 도넛 / 산업분야별 매출 비중 / 제품 시리즈별 매출 비중
import "server-only";

import { INDUSTRIES } from "@/shared/contracts/production";
import { serializeBigInt } from "@/shared/format/bigint";
import { INDUSTRY_COLORS, SERIES_COLORS } from "@/shared/ui/chart-colors";

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
  const [industry, series] = await Promise.all([
    getSalesShareByIndustry(summary.period),
    getSalesShareBySeries(summary.period),
  ]);

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
        badge={industry.source === "mock" ? SAMPLE_BADGE : undefined}
        items={serializeBigInt(industry.items)}
        order={INDUSTRIES.map((i) => i.key)}
        colors={INDUSTRY_COLORS}
      />
      <ShareDonut
        title={`${summary.label} 제품 시리즈별 매출 비중`}
        badge={series.source === "mock" ? SAMPLE_BADGE : undefined}
        items={serializeBigInt(series.items)}
        order={Object.keys(SERIES_COLORS)}
        colors={SERIES_COLORS}
      />
    </section>
  );
}
