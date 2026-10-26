// 생산팀 → 경영지원팀 연동 형식 (docs/interface-production.md, 합의 전 초안)
import type { Period } from "@/shared/period/period";

/** 원형 그래프 한 조각 */
export type SalesShareItem = {
  key: string; // 분류 코드 (예: "WATER")
  label: string; // 화면 표시명 (예: "상하수도")
  amount: bigint; // 판매 금액 합계 (원)
  quantity: number; // 판매 수량 합계 (대)
};

export type SalesShareResult = {
  items: SalesShareItem[];
  /** "mock": 통합 전 목업 데이터 — 화면에 "목업" 표시 */
  source: "mock" | "production";
};

export type SalesShareFn = (period: Period) => Promise<SalesShareResult>;

/** 산업분야 분류 — 처음 요구사항의 7개 분류 (2026-10-26 확정, 05-6번), 비중은 금액 기준(05-10) */
export const INDUSTRIES = [
  { key: "WATER", label: "상하수도" },
  { key: "POWER", label: "발전소" },
  { key: "GAS", label: "가스" },
  { key: "OIL", label: "오일" },
  { key: "PETROLEUM", label: "석유" },
  { key: "PRIVATE_PLANT", label: "민간 플랜트" },
  { key: "ETC", label: "기타" },
] as const;
