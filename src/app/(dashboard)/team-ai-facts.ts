// AI 분석 입력용 생산·서비스 숫자 (서버 전용) — 메인 "팀별 현황" 카드와 같은 공개 함수(index.ts)
// 경영지원 모듈은 다른 팀 모듈을 import 하지 않으므로 app 계층에서 모아 넘긴다. 권한이 없거나 실패하면 그 팀만 null
import "server-only";

import {
  getProductionOverview,
  getSalesShareByIndustry,
  getSalesShareBySeries,
} from "@/modules/production";
import { getServiceOverview } from "@/modules/service";
import type { TeamAiFacts } from "@/shared/contracts/team-ai";
import type { Period } from "@/shared/period/period";

const orNull = <T>(p: Promise<T>) => p.catch(() => null);

export async function loadTeamAiFacts(period: Period): Promise<TeamAiFacts> {
  const [production, industry, series, service] = await Promise.all([
    orNull(getProductionOverview(period)),
    orNull(getSalesShareByIndustry(period)),
    orNull(getSalesShareBySeries(period)),
    orNull(getServiceOverview(period)),
  ]);
  return { production, industry, series, service };
}
