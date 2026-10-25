// 관리자(대표) 화면 변경 이력 — 기록할 칸 목록 (영역 "admin": 보는 화면에서 관리자(대표)만 본다)
// 비밀번호·해시·임시 비밀번호·로그인 실패 횟수·잠금 시각은 목록에 없다 → 기록되지 않는다
import { labelOf, text, type AuditField } from "@/shared/audit/diff";
import { TEAM_LABEL } from "@/shared/auth/types";

/** 화면 문구에서 관리자는 고객사가 알아볼 수 있게 "관리자(대표)" */
export const AUDIT_ROLE_LABEL: Record<string, string> = {
  ADMIN: "관리자(대표)",
  MANAGEMENT: "경영지원팀",
  LEADER: "팀장",
  MEMBER: "팀원",
};

const teams = (v: unknown) => {
  const list = Array.isArray(v) ? (v as string[]) : [];
  return list.length === 0
    ? null
    : list.map((t) => TEAM_LABEL[t as keyof typeof TEAM_LABEL] ?? t).join(", ");
};

export type UserScopeAuditRow = {
  role: string;
  viewTeams: string[];
  editTeams: string[];
};

export const ROLE_CHANGE_FIELDS: AuditField<UserScopeAuditRow>[] = [
  { key: "role", label: "역할", format: labelOf(AUDIT_ROLE_LABEL) },
  { key: "viewTeams", label: "열람 범위", format: teams },
  { key: "editTeams", label: "수정 권한", format: teams },
];

/** 계정 생성: 아이디·이름·역할만 (2026-10-25 결정) */
export type NewUserAuditRow = { loginId: string; name: string; role: string };

export const ACCOUNT_CREATE_FIELDS: AuditField<NewUserAuditRow>[] = [
  { key: "loginId", label: "아이디", format: text },
  { key: "name", label: "이름", format: text },
  { key: "role", label: "역할", format: labelOf(AUDIT_ROLE_LABEL) },
];

/** "윤경영(mgmt_member)" */
export const userTargetLabel = (u: {
  name?: string | null;
  loginId?: string | null;
  id: string;
}) => (u.name && u.loginId ? `${u.name}(${u.loginId})` : (u.loginId ?? u.id));
