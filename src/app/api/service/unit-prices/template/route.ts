// 단가 업로드 양식 (CSV, 가짜 예시 1줄) — ?kind=items|quotes. 권한: 서비스 view
import { buildUnitPriceTemplate } from "@/modules/service";

export async function GET(request: Request) {
  const out = await buildUnitPriceTemplate(
    new URL(request.url).searchParams.get("kind") ?? "",
  );
  if (out === "forbidden") {
    return new Response("서비스팀 자료를 볼 권한이 없습니다.", { status: 403 });
  }
  if (out === "bad-request") {
    return new Response("양식 종류가 올바르지 않습니다.", { status: 400 });
  }
  return new Response(out.body as BodyInit, {
    headers: {
      "Content-Type": out.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(out.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
