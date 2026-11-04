// 스크립트용 생산·서비스 숫자 (로그인 없이 — 화면은 src/app/(dashboard)/team-ai-facts.ts 가 공개 함수로 같은 값을 만든다)
// 같은 집계 함수(productionOverview·salesShareBy*·serviceOverview)를 써서 예시 분석의 입력 해시가 화면과 같게
import {
  loadCategories,
  loadRecords,
  loadTargets,
} from "@/modules/production/data/load-records";
import {
  productionOverview,
  salesShareByIndustry,
  salesShareBySeries,
} from "@/modules/production/metrics/sales-share";
import { loadReports } from "@/modules/service/data/load-reports";
import { serviceOverview } from "@/modules/service/metrics/overview";
import type { TeamAiFacts } from "@/shared/contracts/team-ai";
import type { Period } from "@/shared/period/period";

export async function loadTeamAiFactsForScript(
  period: Period,
): Promise<TeamAiFacts> {
  const rows = await loadRecords(period);
  const [categories, targets, reports] = await Promise.all([
    loadCategories(rows.map((r) => r.orderNo)),
    loadTargets(period.year),
    loadReports(period),
  ]);
  return {
    production: productionOverview(rows, targets, period),
    industry: salesShareByIndustry(rows, categories, period),
    series: salesShareBySeries(rows, period),
    service: serviceOverview(reports),
  };
}
