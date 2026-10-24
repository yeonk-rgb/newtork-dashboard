// 작성자·수정자 id → 화면 표시 이름 (사용자 테이블 조회)
// 작성자 필드(createdById 등)는 외래키 없이 문자열로 저장한다 — 샘플 데이터 "seed"·"seed-*", 이전 개발용 "dev-*" 값이 남아 있을 수 있음
import "server-only";

import { prisma } from "@/shared/db/client";

export type NameOf = (id: string | null | undefined) => string;

/** 고정 표시 이름 (사용자 테이블에 없는 id) */
export function fallbackName(id: string): string {
  if (id === "seed" || id.startsWith("seed-")) return "샘플 데이터";
  if (id.startsWith("dev-")) return "이전 개발 사용자";
  return "알 수 없는 사용자";
}

/** id 목록의 이름을 한 번에 조회해서, id → 이름 함수를 돌려준다 */
export async function loadUserNames(
  ids: Iterable<string | null | undefined>,
): Promise<NameOf> {
  const unique = [...new Set([...ids].filter((id): id is string => !!id))];
  const users = unique.length
    ? await prisma.authUser.findMany({
        where: { id: { in: unique } },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return (id) => (id ? (names.get(id) ?? fallbackName(id)) : "-");
}
