// 변경 이력 엑셀 내려받기 (?from=2026-10-01&to=2026-10-31&actor=&screen=&action=&q=) — 관리자(대표)만
// 권한은 exportHistory() 안에서 다시 확인한다 (경영지원팀이 주소로 직접 와도 403). 캐시 금지(no-store)
import { exportHistory, HistoryExportError } from "@/modules/management";
import { getCurrentUser } from "@/shared/auth";

const NO_STORE = { "Cache-Control": "no-store" };

const text = (status: number, message: string) =>
  new Response(message, {
    status,
    headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
  });

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return text(403, "권한이 없습니다.");
  try {
    const file = await exportHistory(new URL(request.url).searchParams, user);
    console.info(
      `[history-export] user=${user.loginId} file=${file.asciiName} rows=${file.rowCount}`,
    );
    return new Response(new Uint8Array(file.body), {
      headers: {
        ...NO_STORE,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${file.asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      },
    });
  } catch (error) {
    if (error instanceof HistoryExportError) {
      return text(error.status, error.message);
    }
    console.error("[history-export] 실패", error);
    return text(500, "엑셀 파일을 만들지 못했습니다. 잠시 후 다시 시도하세요.");
  }
}
