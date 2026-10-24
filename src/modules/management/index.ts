// management 모듈 공개 API — 다른 곳에서는 이 파일에서 export한 것만 사용한다. (서버 전용)
import "server-only";

import { can, getCurrentUser } from "@/shared/auth";
import { monthIndex, type Period } from "@/shared/period/period";

import { getTodayKst, loadSummaryInput } from "./data/load-summary-input";
import { loadFinanceMonths } from "./data/queries";
import { DEFAULT_METRICS_SETTINGS } from "./metrics/settings";
import { computeManagementSummary } from "./metrics/summary";
import { computeTrend, trendRange, type TrendPoint } from "./metrics/trend";
import type { ManagementSummary } from "./metrics/types";

export class ForbiddenError extends Error {
  constructor() {
    super("경영지원 지표를 볼 권한이 없습니다.");
    this.name = "ForbiddenError";
  }
}

/** 기간별 경영지원 지표 (확정된 달만 집계). 권한: 경영지원팀 view */
export async function getManagementSummary(
  period: Period,
): Promise<ManagementSummary> {
  const user = await getCurrentUser();
  if (!user || !can(user, "view", "management")) throw new ForbiddenError();
  return computeManagementSummary(
    await loadSummaryInput(period, await getTodayKst()),
  );
}

/**
 * 월별 추이 (차트용): 기간 끝에서 거꾸로 12개월, DB 조회 1번.
 * 미확정 월은 값 + status, 데이터 없는 달은 null. 권한: 경영지원팀 view
 */
export async function getManagementTrend(
  period: Period,
): Promise<TrendPoint[]> {
  const user = await getCurrentUser();
  if (!user || !can(user, "view", "management")) throw new ForbiddenError();
  const range = trendRange(period).map(monthIndex);
  const months = await loadFinanceMonths(range[0], range.at(-1)!);
  return computeTrend(
    period,
    months,
    await getTodayKst(),
    DEFAULT_METRICS_SETTINGS.costMode,
  );
}

// 대시보드 화면 조각 (메인·경영지원 상세 공용)
export {
  DashboardTop,
  DashboardTopSkeleton,
  resolvePeriod,
} from "./components/dashboard-top";
export { DashboardDonuts } from "./components/donuts/dashboard-donuts";
export { MainBottom } from "./components/bottom/main-bottom";
export { AiCommentSection } from "./ai/ai-comment-card";
export { ManagementDetail } from "./components/detail/management-detail";

// 6단계 입력 화면
export { EntryScreen } from "./entry/entry-screen";
export { SettingsScreen } from "./settings/settings-screen";
export { ReceivablesScreen } from "./receivables/receivables-screen";
export { LedgerScreen } from "./ledger/ledger-screen";
export { LedgerImportScreen } from "./ledger/import/import-screen";
export { UploadScreen } from "./upload/upload-screen";
export { buildTemplate, TEMPLATE_FILE_NAME } from "./upload/template";

// 메인 원형 그래프용 생산팀 데이터 — 통합 전까지 목업 (source: "mock")
export {
  getSalesShareByIndustry,
  getSalesShareBySeries,
} from "./external/production-mock";

export type {
  ManagementSummary,
  AmountShare,
  Change,
  Comparison,
  ReceivableResult,
  TargetResult,
} from "./metrics/types";
export type { TrendPoint, TrendStatus } from "./metrics/trend";
