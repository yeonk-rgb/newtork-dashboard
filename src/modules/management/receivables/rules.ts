// 미수금 건별 기록 규칙 (순수 함수): 권한별 가능한 동작, 날짜 검사, 목록 필터
// 화면(클라이언트)에서도 쓰므로 server-only 인 "@/shared/auth" 대신 순수 모듈을 직접 가져온다
import { can } from "@/shared/auth/can";
import type { AppUser } from "@/shared/auth/types";

import { agingBucket, daysBetween } from "../metrics/receivables";

/** 화면에 넘기는 미수금 한 건 (날짜는 "YYYY-MM-DD", 금액은 정수 문자열) */
export type ReceivableRow = {
  id: string;
  customerName: string;
  occurredOn: string;
  amount: string;
  dueOn: string | null;
  note: string | null;
  isCollected: boolean;
  collectedOn: string | null;
  /** 동시 수정 확인용 (ISO) */
  updatedAt: string;
  updatedBy: string;
  hidden: boolean;
  /** 숨긴 일시 (ISO) */
  deletedAt: string | null;
  deletedBy: string | null;
};

// ---------- 권한 ----------

export type ReceivableAbilities = {
  /** 거래처·발생일·금액·예정일·비고 수정 (수금 완료 건은 팀장만) */
  canEdit: boolean;
  /** 수금 처리 */
  canCollect: boolean;
  /** 수금 취소 (미수로 되돌리기) */
  canUncollect: boolean;
  canHide: boolean;
  canRestore: boolean;
  /** 버튼이 없을 때 보여줄 안내 */
  notice: string | null;
};

/** 등록: edit(경영지원 팀원 이상) */
export function canCreateReceivable(user: AppUser): boolean {
  return can(user, "edit", "management");
}

/** 숨긴 항목 보기·복구: confirm(팀장·관리자·대표) */
export function canManageHidden(user: AppUser): boolean {
  return can(user, "confirm", "management");
}

/**
 * 건별로 가능한 동작. 서버 Server Action 과 화면이 같은 함수를 쓴다.
 * - 미수 건: edit 권한으로 수정·수금 처리
 * - 수금 완료 건: 수정·수금 취소는 confirm 권한만
 * - 숨김·복구: confirm 권한만, 숨긴 건은 복구 외에 아무것도 못 한다
 */
export function receivableAbilities(
  user: AppUser,
  row: { isCollected: boolean; hidden: boolean },
): ReceivableAbilities {
  const edit = can(user, "edit", "management");
  const confirm = can(user, "confirm", "management");
  const none: ReceivableAbilities = {
    canEdit: false,
    canCollect: false,
    canUncollect: false,
    canHide: false,
    canRestore: false,
    notice: null,
  };

  if (row.hidden) {
    return confirm
      ? { ...none, canRestore: true }
      : { ...none, notice: "숨긴 항목은 팀장만 복구할 수 있습니다." };
  }
  if (row.isCollected) {
    return confirm
      ? { ...none, canEdit: true, canUncollect: true, canHide: true }
      : {
          ...none,
          notice: edit ? "수금 완료 건은 팀장만 수정할 수 있습니다." : null,
        };
  }
  return {
    ...none,
    canEdit: edit,
    canCollect: edit,
    canHide: confirm,
  };
}

// ---------- 날짜 ----------

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" → UTC 자정 Date (형식이 틀리거나 없는 날짜면 null) */
export function parseDateOnly(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // 2026-02-30 같은 날짜는 Date 가 3월로 넘겨 버리므로 되돌려 비교
  return date.toISOString().slice(0, 10) === value ? date : null;
}

/** UTC 자정 Date → "YYYY-MM-DD" */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type DateFields = {
  occurredOn: string;
  dueOn?: string | null;
  collectedOn?: string | null;
};

/**
 * 날짜 규칙 위반 (필드 → 메시지). 비어 있으면 통과.
 * - 발생일: 필수, 오늘 이후 불가
 * - 수금 예정일: 선택, 발생일 이후
 * - 수금일: 오늘 이후 불가, 발생일 이후
 * @param today "YYYY-MM-DD" (한국 날짜)
 */
export function receivableDateErrors(
  fields: DateFields,
  today: string,
): Partial<Record<keyof DateFields, string>> {
  const errors: Partial<Record<keyof DateFields, string>> = {};
  const occurred = parseDateOnly(fields.occurredOn);
  if (!occurred) {
    errors.occurredOn = "발생일을 입력하세요.";
  } else if (fields.occurredOn > today) {
    errors.occurredOn = "발생일은 오늘 이후로 입력할 수 없습니다.";
  }

  if (fields.dueOn) {
    if (!parseDateOnly(fields.dueOn)) {
      errors.dueOn = "수금 예정일 형식이 올바르지 않습니다.";
    } else if (occurred && fields.dueOn < fields.occurredOn) {
      errors.dueOn = "수금 예정일은 발생일보다 이를 수 없습니다.";
    }
  }

  if (fields.collectedOn !== undefined) {
    if (!fields.collectedOn || !parseDateOnly(fields.collectedOn)) {
      errors.collectedOn = "수금일을 입력하세요.";
    } else if (fields.collectedOn > today) {
      errors.collectedOn = "미래 날짜로 수금 처리할 수 없습니다.";
    } else if (occurred && fields.collectedOn < fields.occurredOn) {
      errors.collectedOn = "수금일은 발생일보다 이를 수 없습니다.";
    }
  }
  return errors;
}

// ---------- 거래처 이름 ----------

export const CUSTOMER_MAX = 50;
export const NOTE_MAX = 200;

/** 앞뒤 공백 제거, 연속 공백 하나로 */
export function normalizeCustomerName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

// ---------- 목록 필터 ----------

export const RECEIVABLE_TABS = [
  { key: "open", label: "미수" },
  { key: "collected", label: "수금 완료" },
  { key: "over90", label: "90일 초과" },
  { key: "overdue", label: "예정일 지남" },
  { key: "all", label: "전체" },
] as const;
export type ReceivableTab = (typeof RECEIVABLE_TABS)[number]["key"];

export function parseReceivableTab(value: string | undefined): ReceivableTab {
  return RECEIVABLE_TABS.some((t) => t.key === value)
    ? (value as ReceivableTab)
    : "open";
}

export type RowStatus = {
  /** 미수 건: 발생일부터 오늘까지 경과일 (수금 완료면 null) */
  ageDays: number | null;
  isOver90: boolean;
  /** 미수인데 수금 예정일이 오늘보다 앞섬 */
  isOverdue: boolean;
};

/** 오늘 기준 상태 — 경과일 구간은 대시보드와 같은 규칙 (발생일 기준, 05-17번) */
export function rowStatus(row: ReceivableRow, today: string): RowStatus {
  if (row.isCollected)
    return { ageDays: null, isOver90: false, isOverdue: false };
  const occurred = parseDateOnly(row.occurredOn);
  const now = parseDateOnly(today);
  const ageDays = occurred && now ? daysBetween(occurred, now) : null;
  return {
    ageDays,
    isOver90: ageDays !== null && agingBucket(ageDays) === "90+",
    isOverdue: row.dueOn !== null && row.dueOn < today,
  };
}

export function matchesTab(
  row: ReceivableRow,
  tab: ReceivableTab,
  today: string,
): boolean {
  const status = rowStatus(row, today);
  switch (tab) {
    case "open":
      return !row.isCollected;
    case "collected":
      return row.isCollected;
    case "over90":
      return status.isOver90;
    case "overdue":
      return status.isOverdue;
    case "all":
      return true;
  }
}

/** 거래처 검색: 공백·대소문자 무시, 부분 일치 */
export function matchesSearch(row: ReceivableRow, query: string): boolean {
  const q = query.replace(/\s+/g, "").toLowerCase();
  if (q === "") return true;
  return row.customerName.replace(/\s+/g, "").toLowerCase().includes(q);
}

export function filterReceivables(
  rows: ReceivableRow[],
  tab: ReceivableTab,
  query: string,
  today: string,
): ReceivableRow[] {
  return rows.filter(
    (r) => matchesTab(r, tab, today) && matchesSearch(r, query),
  );
}

/** 탭별 건수 (검색어 반영) */
export function tabCounts(
  rows: ReceivableRow[],
  query: string,
  today: string,
): Record<ReceivableTab, number> {
  const searched = rows.filter((r) => matchesSearch(r, query));
  return Object.fromEntries(
    RECEIVABLE_TABS.map((t) => [
      t.key,
      searched.filter((r) => matchesTab(r, t.key, today)).length,
    ]),
  ) as Record<ReceivableTab, number>;
}
