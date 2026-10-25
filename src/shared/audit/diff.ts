// 변경 이력 비교 (순수 함수) — "기록할 칸" 목록(허용 목록)에 있는 칸만, 바뀐 칸만, 화면 표기 그대로의 글자로
// 표시 규칙(2026-10-25 결정): 금액 "12,500,000원", 날짜 "2026-10-15", 상태·유형은 화면과 같은 한글
import type { AuditChange } from "./types";

/** 값 → 화면 표기 (빈 값은 null) */
export type AuditFormat = (value: unknown) => string | null;

export type AuditField<T> = {
  key: keyof T & string;
  /** 화면 칸 이름 (예: "거래처명") */
  label: string;
  format?: AuditFormat;
};

const isEmpty = (v: unknown) => v === null || v === undefined || v === "";

/** 기본: 글자·숫자 그대로 (앞뒤 공백 제거, 빈 글자는 null) */
export const text: AuditFormat = (v) => {
  if (isEmpty(v)) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/** 금액(원, bigint·숫자·정수 글자) → "12,500,000원" */
export const won: AuditFormat = (v) => {
  if (isEmpty(v)) return null;
  const n = typeof v === "bigint" ? v : BigInt(String(v));
  const sign = n < 0n ? "-" : "";
  const digits = (n < 0n ? -n : n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${digits}원`;
};

/** 날짜(UTC 자정 Date 또는 "YYYY-MM-DD") → "2026-10-15" */
export const date: AuditFormat = (v) => {
  if (isEmpty(v)) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

/** 선택값 → 화면 한글 (예: "LONG_OVERDUE" → "장기미수") */
export const labelOf =
  (labels: Record<string, string>): AuditFormat =>
  (v) =>
    isEmpty(v) ? null : (labels[String(v)] ?? String(v));

/** 참·거짓 → 글자 (예: 자동이체 true → "자동이체", false → 빈 값) */
export const flag =
  (whenTrue: string, whenFalse: string | null = null): AuditFormat =>
  (v) =>
    v ? whenTrue : whenFalse;

/**
 * before → after 에서 바뀐 칸만 (추가는 before = null, 전부 비교)
 * 비교는 화면 표기 글자끼리 — 저장값이 달라도 화면에 같게 보이면 기록하지 않는다
 */
export function diffFields<T extends object>(
  before: Partial<T> | null,
  after: Partial<T> | null,
  fields: AuditField<T>[],
): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const f of fields) {
    const format = f.format ?? text;
    const b = before ? format(before[f.key]) : null;
    const a = after ? format(after[f.key]) : null;
    if (b !== a)
      changes.push({ field: f.key, label: f.label, before: b, after: a });
  }
  return changes;
}
