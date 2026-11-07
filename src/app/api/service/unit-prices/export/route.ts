// 단가 내려받기 (엑셀·CSV) — 화면과 같은 조건. 권한: 서비스 view
import { buildUnitPriceExport } from "@/modules/service";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const out = await buildUnitPriceExport({
    kind: sp.get("kind") ?? "",
    q: sp.get("q") ?? "",
    category: sp.get("category") ?? "",
    format: sp.get("format") ?? "xlsx",
  });
  if (out === "forbidden") {
    return new Response("서비스팀 자료를 볼 권한이 없습니다.", { status: 403 });
  }
  if (out === "bad-request") {
    return new Response("내려받을 자료 종류가 올바르지 않습니다.", {
      status: 400,
    });
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
