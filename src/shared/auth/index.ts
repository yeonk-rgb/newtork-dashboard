// 인증·권한 공개 API (서버 전용). 화면·Server Action은 여기서 가져다 쓴다.
// 클라이언트 컴포넌트는 타입·라벨만 필요하면 "@/shared/auth/types" 를 직접 import 한다.
export {
  accessiblePages,
  canAccessAdmin,
  homePathFor,
  NO_ACCESS_PATH,
} from "./access";
export type { NavItem } from "./access";
export { can, canManageUsers } from "./can";
export { getCurrentUser } from "./current-user";
export { generateTempPassword, hashPassword } from "./password";
export { deleteUserSessions } from "./session";
export { loadUserNames } from "./user-names";
export type { NameOf } from "./user-names";
export { ROLE_LABEL, ROLES, roleLabel, SCOPE_TEAMS, TEAM_LABEL } from "./types";
export type { Action, AppUser, Role, ScopeTeam, Team } from "./types";
