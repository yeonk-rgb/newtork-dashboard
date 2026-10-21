// 관리자 설정 화면 데이터 (서버 전용) — 비밀번호 해시 등 민감한 칸은 화면으로 보내지 않는다
import "server-only";

import { prisma } from "@/shared/db/client";

import type { AdminUserRow } from "./user-table";

/** "2026. 10. 19. 오후 3:05:48" (한국 시간) */
export function loginLabel(date: Date): string {
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

/** 활성 계정(아이디순) → 비활성 계정(아이디순) */
export async function loadAdminUsers(): Promise<AdminUserRow[]> {
  const rows = await prisma.authUser.findMany({
    orderBy: { loginId: "asc" },
    select: {
      id: true,
      loginId: true,
      name: true,
      role: true,
      viewTeams: true,
      editTeams: true,
      mustChangePassword: true,
      lastLoginAt: true,
      deactivatedAt: true,
      updatedAt: true,
    },
  });
  return rows
    .map((r) => ({
      id: r.id,
      loginId: r.loginId,
      name: r.name,
      role: r.role,
      viewTeams: r.viewTeams,
      editTeams: r.editTeams,
      mustChangePassword: r.mustChangePassword,
      lastLogin: r.lastLoginAt ? loginLabel(r.lastLoginAt) : null,
      active: r.deactivatedAt === null,
      deactivatedAt: r.deactivatedAt?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
    }))
    .sort((a, b) => Number(b.active) - Number(a.active));
}
