// 관리자 설정 화면 (서버 컴포넌트) — 관리자만, 그 외 403
import { canManageUsers, getCurrentUser } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";

import { loadAdminUsers } from "./load-users";
import { UserTable } from "./user-table";
import { pageTitleClass } from "@/shared/ui/styles";

export async function AdminScreen() {
  const user = await getCurrentUser();
  if (!user || !canManageUsers(user)) return <Forbidden user={user} />;
  const users = await loadAdminUsers();

  return (
    <div className="space-y-6">
      <h1 className={pageTitleClass}>관리자 설정</h1>
      <UserTable actorId={user.id} users={users} />
    </div>
  );
}
