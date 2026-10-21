// 관리자 설정 화면 (서버 컴포넌트) — 관리자만, 그 외 403
import { canManageUsers, getCurrentUser } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";

import { loadAdminUsers } from "./load-users";
import { UserTable } from "./user-table";

export async function AdminScreen() {
  const user = await getCurrentUser();
  if (!user || !canManageUsers(user)) return <Forbidden user={user} />;
  const users = await loadAdminUsers();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">관리자 설정</h1>
      <UserTable actorId={user.id} users={users} />
    </div>
  );
}
