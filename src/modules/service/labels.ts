// 서비스 화면 이름 표 — 친구 저장소 frontend/src/constants/service.js · models.py 이름 그대로
export const BILLING_LABEL: Record<string, string> = {
  PAID: "유상",
  FREE: "무상",
};

/** 출장보고서 PDF 의 사진·자료 구역과 같은 순서 */
export const ATTACHMENT_KINDS = [
  { value: "ORIGINAL", label: "보고서 원본(PDF)" },
  { value: "NAMEPLATE", label: "명판 사진" },
  { value: "BEFORE_WORK", label: "작업 전 사진" },
  { value: "AFTER_WORK", label: "작업 후 사진" },
  { value: "BEFORE_PART", label: "부품 교체 전 사진" },
  { value: "AFTER_PART", label: "부품 교체 후 사진" },
  { value: "RELATED", label: "관련 자료(판넬 도면 등)" },
] as const;

export const ATTACHMENT_KIND_LABEL: Record<string, string> = Object.fromEntries(
  ATTACHMENT_KINDS.map((k) => [k.value, k.label]),
);

export function formatBytes(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

/** 금액 표시 — 없으면 "-" (친구 composables/sitePrices.js won) */
export const won = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "-"
    : `${Math.round(v).toLocaleString("ko-KR")}원`;

/** 비율(0~1) → "62.5%" (친구 앱 소수 1자리) */
export const pct = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "-"
    : `${(Math.round(v * 1000) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
