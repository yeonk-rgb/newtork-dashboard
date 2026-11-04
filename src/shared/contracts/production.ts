// 생산팀 → 경영지원팀 연동 형식 (docs/interface-production.md)
// 2026-11-03 통합 1단계: 생산팀 데이터에 금액이 없어 비중은 "확정 출고 수량" 기준 (05-10 갱신)
import type { Period } from "@/shared/period/period";

/** 원형 그래프 한 조각 */
export type SalesShareItem = {
  key: string; // 분류 코드 (예: "WATER", 모델명 "02")
  label: string; // 화면 표시명 (예: "상하수도")
  amount: bigint; // 판매 금액 합계 (원) — 수량 기준이면 0n
  quantity: number; // 판매 수량 합계 (대)
};

export type SalesShareResult = {
  items: SalesShareItem[];
  /** "mock": 목업 데이터 — 화면에 "샘플 데이터" 표시 */
  source: "mock" | "production";
  /** 비중 기준: 금액 / 확정 출고 수량 (생산팀 실제 데이터는 "quantity") */
  basis: "amount" | "quantity";
  /** 기간 안에 출고됐지만 수량을 입력하지 않아 뺀 행 수 (수량 미확정) */
  unconfirmedRows: number;
  /** 산업분야만: 사업구분을 지정하지 않은 수주번호의 수량 (조각에 넣지 않고 안내) */
  unclassifiedQuantity: number;
  /** 시연용 가짜 데이터(시드)가 섞여 있으면 true — "샘플 데이터" 표시 */
  hasSample: boolean;
};

export type SalesShareFn = (period: Period) => Promise<SalesShareResult>;

/** 산업분야 분류 — 처음 요구사항의 7개 분류 (2026-10-26 확정, 05-6번) */
export const INDUSTRIES = [
  { key: "WATER", label: "상하수도" },
  { key: "POWER", label: "발전소" },
  { key: "GAS", label: "가스" },
  { key: "OIL", label: "오일" },
  { key: "PETROLEUM", label: "석유" },
  { key: "PRIVATE_PLANT", label: "민간 플랜트" },
  { key: "ETC", label: "기타" },
] as const;

/** 제품별 조각이 많으면 상위 5개 + 이 키("기타 모델 N개") */
export const OTHER_SERIES_KEY = "OTHER_MODELS";

/** 메인 "팀별 현황" 생산 카드 (확정 출고 수량 기준, 출고일자 기준) */
export type ProductionOverview = {
  /** 확정 출고 수량 (대) */
  confirmedQuantity: number;
  /** 기간 목표 (대) — 월 = 월 목표, 분기·누적 = 월 목표 합(모두 입력됐을 때만), 연간 = 연간 목표. 없으면 null */
  target: number | null;
  /** 목표가 없는 이유 (예: "2/3개월만 입력") — target 이 있으면 null */
  targetNote: string | null;
  /** 달성률 0~1+ (목표 없으면 null) */
  achievement: number | null;
  /** 부족 수량 max(목표 − 확정, 0) (목표 없으면 null) — 생산 대시보드 KPI 와 같음 */
  shortfall: number | null;
  /** 출고됐지만 수량 미확정 행 수 */
  unconfirmedRows: number;
  /** 기간 안 납기 일정 수 (같은 납기일 + 같은 수주번호 = 1건) */
  dueEvents: number;
  /** 그중 출고일 없는 제품이 남은 일정 수 */
  dueEventsPending: number;
  hasSample: boolean;
};
