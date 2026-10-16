// 배포 빌드 접근 차단 — 실제 로그인 전에는 외부 공개 배포 금지.
// `next start`(NODE_ENV=production)에서는 .env 에 DEMO_MODE=true 가 있을 때만 통과(시연용).
// 실제 로그인으로 교체할 때: 이 차단을 미로그인 사용자 → /login 이동으로 바꾼다.
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const blocked =
    process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true";

  if (blocked) {
    return new NextResponse(
      "접근이 차단되었습니다. 실제 로그인 기능이 준비되기 전에는 배포 환경에서 사용할 수 없습니다. (시연: DEMO_MODE=true)",
      { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  return NextResponse.next({ request });
}

export const config = {
  // 정적 파일·이미지 최적화 경로는 제외
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
