// management 모듈 공개 API — 다른 곳에서는 이 파일에서 export한 것만 사용한다. (서버 전용)
import "server-only";

import { can, getCurrentUser } from "@/shared/auth";
import type { Period } from "@/shared/period/period";

import { getTodayKst, loadSummaryInput } from "./data/load-summary-input";
import { computeManagementSummary } from "./metrics/summary";
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

// 대시보드 화면 조각 (메인·경영지원 상세 공용)
export {
  DashboardTop,
  DashboardTopSkeleton,
  resolvePeriod,
} from "./components/dashboard-top";

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
