// 로그인·라우트 보호 — 모든 요청이 페이지보다 먼저 여기를 지난다 (Next 16: proxy 는 Node.js 런타임)
// 1) 로그인 안 함 → /login?next=…   2) 초기 비밀번호 사용 중 → /account/password?next=…
// 3) 경로 권한 (route-access.ts): 메인 → 볼 수 없으면 자기 팀으로, 팀·관리자 경로 → 권한 없으면 403 화면
//    생산·서비스 페이지 파일을 고치지 않고 여기서 막는다. 레이아웃은 페이지 이동 때 다시 실행되지 않으므로
//    권한 확인을 레이아웃에 두지 않는다. 각 페이지·Server Action의 can() 확인도 그대로 둔다 (이중 확인).
import { NextResponse, type NextRequest } from "next/server";

import { routeAccess } from "@/shared/auth/route-access";
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

  const access = routeAccess(user, pathname);
  if (access.type === "redirect") {
    return NextResponse.redirect(new URL(access.to, request.url));
  }
  if (access.type === "forbidden") {
    if (isApi(pathname)) {
      return new NextResponse("권한이 없습니다.", { status: 403 });
    }
    // 주소는 그대로 두고 권한 없음 화면을 보여준다
    // (rewrite 는 페이지 응답 상태를 바꾸지 못해 HTTP 상태는 200 — 403 상태가 필요하면 Next 실험 기능
    //  experimental.authInterrupts 의 forbidden() 이 필요해 쓰지 않음. API 는 위에서 실제 403)
    return NextResponse.rewrite(new URL("/forbidden", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // 정적 파일·이미지 최적화 경로는 제외
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
