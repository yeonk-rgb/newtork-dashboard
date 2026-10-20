// 로그인 확인 — 모든 요청이 페이지보다 먼저 여기를 지난다 (Next 16: proxy 는 Node.js 런타임)
// 1) 로그인 안 함 → /login?next=…   2) 초기 비밀번호 사용 중 → /account/password?next=…
// 권한 확인은 각 페이지·Server Action의 can()에서 한다.
import { NextResponse, type NextRequest } from "next/server";

import { findSessionUser, SESSION_COOKIE } from "@/shared/auth/session";

const PUBLIC_PATHS = new Set(["/login"]);
const PASSWORD_PATH = "/account/password";

const isApi = (pathname: string) => pathname.startsWith("/api/");

function redirectWithNext(request: NextRequest, to: string) {
  const { pathname, search } = request.nextUrl;
  const url = new URL(to, request.url);
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  // proxy 는 미리 그리기(prerender) 대상이 아니므로 현재 시각을 바로 쓴다
  const user = await findSessionUser(token, new Date());

  if (!user) {
    if (isApi(pathname)) {
      return new NextResponse("로그인이 필요합니다.", { status: 401 });
    }
    const response = redirectWithNext(request, "/login");
    // 만료·비활성 세션 쿠키는 지운다
    if (token) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (user.mustChangePassword && pathname !== PASSWORD_PATH) {
    if (isApi(pathname)) {
      return new NextResponse("비밀번호를 먼저 변경하세요.", { status: 403 });
    }
    return redirectWithNext(request, PASSWORD_PATH);
  }

  return NextResponse.next();
}

export const config = {
  // 정적 파일·이미지 최적화 경로는 제외
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
