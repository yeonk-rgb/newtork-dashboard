// 변경 이력 공통 타입 (팀 공통) — 기록은 record.ts 의 recordAudit() 로, 비교는 diff.ts 의 diffFields() 로

/** 관리자 화면 기록은 관리자(대표)만 본다. 생산 화면 기록은 2026-11-03 통합 1단계부터, 서비스는 3단계부터 */
export const AUDIT_AREAS = [
  "management",
  "admin",
  "production",
  "service",
] as const;
export type AuditArea = (typeof AUDIT_AREAS)[number];

/** 무엇을 했는지 — 화면 표기는 AUDIT_ACTION_LABEL */
export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "HIDE",
  "RESTORE",
  "DELETE",
  "COLLECT",
  "UNCOLLECT",
  "CONFIRM",
  "UPDATE_CONFIRMED",
  "UNCONFIRM",
  "IMPORT",
  "EXPORT",
  "ROLE_CHANGE",
  "PASSWORD_RESET",
  "ACCOUNT_CREATE",
  "DEACTIVATE",
  "REACTIVATE",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: "추가",
  UPDATE: "수정",
  HIDE: "숨김",
  RESTORE: "복구",
  DELETE: "삭제",
  COLLECT: "수금 처리",
  UNCOLLECT: "수금 취소",
  CONFIRM: "확정",
  UPDATE_CONFIRMED: "확정 후 수정",
  UNCONFIRM: "확정 취소",
  IMPORT: "엑셀 이관",
  EXPORT: "엑셀 다운로드",
  ROLE_CHANGE: "권한 변경",
  PASSWORD_RESET: "비밀번호 초기화",
  ACCOUNT_CREATE: "계정 생성",
  DEACTIVATE: "비활성화",
  REACTIVATE: "다시 사용",
};

/** 바뀐 칸 하나 — 값은 화면 표기 그대로의 글자 (빈 값은 null) */
export type AuditChange = {
  /** 저장 칸 이름 (예: "amount") — 화면에는 label 을 쓴다 */
  field: string;
  /** 화면 칸 이름 (예: "잔액") */
  label: string;
  before: string | null;
  after: string | null;
};

export type AuditEntry = {
  /** 기록 시각 (getNow() — UTC 로 저장) */
  occurredAt: Date;
  actor: { id: string; loginId: string };
  area: AuditArea;
  /** 화면 (예: "ledger", "receivables") */
  screen: string;
  action: AuditAction;
  target: { type: string; id: string; label: string };
  changes?: AuditChange[];
  meta?: Record<string, unknown>;
};
