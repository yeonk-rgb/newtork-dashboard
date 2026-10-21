// 관리자 설정 규칙 (순수 함수 — 화면과 Server Action이 같이 쓴다)
// 클라이언트 컴포넌트도 쓰므로 서버 전용 "@/shared/auth" 대신 types 만 가져온다
import {
  SCOPE_TEAMS,
  type AppUser,
  type Role,
  type ScopeTeam,
} from "@/shared/auth/types";

export type Scope = {
  role: Role;
  viewTeams: ScopeTeam[];
  editTeams: ScopeTeam[];
};

/** 관리자·경영지원팀은 "전체"이므로 체크박스를 쓰지 않는다 */
export function hasAllTeams(role: Role): boolean {
  return role === "ADMIN" || role === "MANAGEMENT";
}

const sortTeams = (teams: readonly ScopeTeam[]) =>
  SCOPE_TEAMS.filter((t) => teams.includes(t));

/**
 * 역할에 맞게 범위 정리
 * - 관리자·경영지원팀: 둘 다 비움("전체")
 * - 팀원: 수정 권한 비움
 * - 팀장: 수정 권한은 열람 범위 안에서만
 */
export function normalizeScope(scope: Scope): Scope {
  if (hasAllTeams(scope.role)) {
    return { role: scope.role, viewTeams: [], editTeams: [] };
  }
  const viewTeams = sortTeams(scope.viewTeams);
  const editTeams =
    scope.role === "LEADER"
      ? sortTeams(scope.editTeams).filter((t) => viewTeams.includes(t))
      : [];
  return { role: scope.role, viewTeams, editTeams };
}

/** 저장할 수 없는 범위면 안내 문구 */
export function scopeError(scope: Scope): string | null {
  if (hasAllTeams(scope.role)) return null;
  if (scope.viewTeams.length === 0) {
    return "팀장·팀원은 열람 범위를 1개 이상 선택하세요.";
  }
  if (scope.role === "MEMBER" && scope.editTeams.length > 0) {
    return "팀원은 수정 권한을 가질 수 없습니다.";
  }
  if (scope.editTeams.some((t) => !scope.viewTeams.includes(t))) {
    return "수정 권한은 열람 범위에서 선택한 팀만 줄 수 있습니다.";
  }
  return null;
}

export function sameScope(a: Scope, b: Scope): boolean {
  const x = normalizeScope(a);
  const y = normalizeScope(b);
  return (
    x.role === y.role &&
    x.viewTeams.join() === y.viewTeams.join() &&
    x.editTeams.join() === y.editTeams.join()
  );
}

type Row = { id: string; role: Role; active: boolean };

/** 변경 후에도 활성 관리자가 1명 이상 남는지 */
export function keepsAnAdmin(
  rows: readonly Row[],
  change: { roles?: Map<string, Role>; deactivate?: string },
): boolean {
  return rows.some((row) => {
    const role = change.roles?.get(row.id) ?? row.role;
    const active = row.active && row.id !== change.deactivate;
    return role === "ADMIN" && active;
  });
}

export const LAST_ADMIN_MESSAGE =
  "관리자는 최소 1명 있어야 합니다. 다른 직원을 먼저 관리자로 지정하세요.";

/** 한 줄에서 할 수 있는 일 (본인 줄은 버튼 대신 "본인") */
export function rowAbilities(actor: Pick<AppUser, "id">, row: Row) {
  const isSelf = actor.id === row.id;
  return {
    isSelf,
    editRole: !isSelf && row.active,
    editScope: !isSelf && row.active,
    resetPassword: !isSelf && row.active,
    deactivate: !isSelf && row.active,
    restore: !isSelf && !row.active,
  };
}
