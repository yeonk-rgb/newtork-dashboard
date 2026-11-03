// production 모듈 공개 API — 다른 곳에서는 이 파일에서 export한 것만 사용한다. (서버 전용)
// 형식: docs/interface-production.md, 타입: shared/contracts/production.ts
import "server-only";

import { can, getCurrentUser } from "@/shared/auth";
import type {
  ProductionOverview,
  SalesShareResult,
} from "@/shared/contracts/production";
import type { Period } from "@/shared/period/period";

import { loadCategories, loadRecords, loadTargets } from "./data/load-records";
import {
  productionOverview,
  salesShareByIndustry,
  salesShareBySeries,
} from "./metrics/sales-share";

export class ProductionForbiddenError extends Error {
  constructor() {
    super("생산팀 데이터를 볼 권한이 없습니다.");
    this.name = "ProductionForbiddenError";
  }
}

async function assertCanView() {
  const user = await getCurrentUser();
  if (!user || !can(user, "view", "production")) {
    throw new ProductionForbiddenError();
  }
}

/** 기간 내 산업분야별 확정 출고 수량 (출고일자 기준). 권한: 생산 view */
export async function getSalesShareByIndustry(
  period: Period,
): Promise<SalesShareResult> {
  await assertCanView();
  const rows = await loadRecords(period);
  const categories = await loadCategories(rows.map((r) => r.orderNo));
  return salesShareByIndustry(rows, categories, period);
}

/** 기간 내 제품(모델명)별 확정 출고 수량 (출고일자 기준). 권한: 생산 view */
export async function getSalesShareBySeries(
  period: Period,
): Promise<SalesShareResult> {
  await assertCanView();
  return salesShareBySeries(await loadRecords(period), period);
}

/** 메인 "팀별 현황" 생산 카드. 권한: 생산 view */
export async function getProductionOverview(
  period: Period,
): Promise<ProductionOverview> {
  await assertCanView();
  const [rows, targets] = await Promise.all([
    loadRecords(period),
    loadTargets(period.year),
  ]);
  return productionOverview(rows, targets, period);
}

// 생산 화면 (통합 2단계 ②-a, 2026-11-03)
export { ProductionUploadScreen } from "./upload/upload-screen";
export { RecordsScreen } from "./records/records-screen";
export { CategoriesScreen } from "./categories/categories-screen";
// ②-b
export { ProductionDashboardScreen } from "./dashboard/dashboard-screen";
