// 생산 화면 이름 표 — 친구 저장소(backend/production/excel.py COLUMNS·models.py) 화면 이름 그대로
import { INDUSTRIES } from "@/shared/contracts/production";

/** 사업구분 코드 → 이름 (shared/contracts INDUSTRIES 와 같음) */
export const INDUSTRY_LABEL: Record<string, string> = Object.fromEntries(
  INDUSTRIES.map((i) => [i.key, i.label]),
);
export const UNCLASSIFIED_LABEL = "미분류";

/** 부시 가공 6자리 → "Ø30x10x08" (6자리 숫자가 아니면 원래 값) */
export function formatBush(value: string): string {
  return /^\d{6}$/.test(value)
    ? `Ø${value.slice(0, 2)}x${value.slice(2, 4)}x${value.slice(4, 6)}`
    : value;
}
