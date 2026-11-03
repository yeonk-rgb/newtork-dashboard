// service 모듈 공개 API — 다른 곳에서는 이 파일에서 export한 것만 사용한다. (서버 전용)
// 형식: docs/interface-production.md 6번, 타입: shared/contracts/service.ts
import "server-only";

import { can, getCurrentUser } from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import type { ServiceOverview } from "@/shared/contracts/service";
import type { Period } from "@/shared/period/period";

import { loadReports } from "./data/load-reports";
import { serviceOverview } from "./metrics/overview";

export class ServiceForbiddenError extends Error {
  constructor() {
    super("서비스팀 데이터를 볼 권한이 없습니다.");
    this.name = "ServiceForbiddenError";
  }
}

/** 메인 "팀별 현황" 서비스 카드 (출장 시작일 기준). 권한: 서비스 view */
export async function getServiceOverview(
  period: Period,
): Promise<ServiceOverview> {
  const user = await getCurrentUser();
  if (!user || !can(user, "view", "service")) {
    throw new ServiceForbiddenError();
  }
  return serviceOverview(await loadReports(period));
}

/** 출장보고서 첨부 파일 (숨긴 첨부·숨긴 보고서 제외). 권한: 서비스 view */
export async function getAttachmentFile(id: string) {
  const user = await getCurrentUser();
  if (!user || !can(user, "view", "service")) return "forbidden" as const;
  return prisma.svcReportAttachment.findFirst({
    where: { id, deletedAt: null, report: { deletedAt: null } },
    select: { content: true, contentType: true, originalName: true },
  });
}

// 서비스 화면 (통합 3단계 ③-a, 2026-11-03)
export { ReportsScreen } from "./reports/reports-screen";
export { ReportDetailScreen } from "./reports/report-detail-screen";
export { ReportFormScreen } from "./reports/report-form-screen";
// ③-b
export { ServiceDashboardScreen } from "./dashboard/dashboard-screen";
