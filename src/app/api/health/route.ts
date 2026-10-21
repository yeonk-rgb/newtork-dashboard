// 헬스체크 (Render healthCheckPath) — 로그인 없이 접근, DB 연결만 확인하고 내부 정보는 내보내지 않는다
import { connection } from "next/server";

import { prisma } from "@/shared/db/client";

export async function GET() {
  // 빌드 때 미리 그리지 않고 요청마다 실행한다 (cacheComponents)
  await connection();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[health] DB 연결 실패", error);
    return Response.json(
      { status: "error" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
