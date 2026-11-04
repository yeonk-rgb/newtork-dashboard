// AI 분석 입력용 생산·서비스 숫자 (2026-11-04 통합 마무리) — 메인 "팀별 현황" 카드와 같은 집계 결과를 그대로 넘긴다
// 경영지원 모듈은 다른 팀 모듈을 import 하지 않으므로 app 계층(page·Server Action)이 만들어 넘긴다 (src/app/(dashboard)/team-ai-facts.ts)
import type { ProductionOverview, SalesShareResult } from "./production";
import type { ServiceOverview } from "./service";

export type TeamAiFacts = {
  /** 생산 열람 권한이 없거나 조회 실패면 null (입력에서 뺌) */
  production: ProductionOverview | null;
  industry: SalesShareResult | null;
  series: SalesShareResult | null;
  service: ServiceOverview | null;
};

export const NO_TEAM_FACTS: TeamAiFacts = {
  production: null,
  industry: null,
  series: null,
  service: null,
};
