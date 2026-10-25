// 경영지원 엑셀 다운로드 (?kind=entry|targets|receivables|report&period=2026-10 | 2026-Q3 | 2026 | 2026-YTD10) — 경영지원 열람 권한이면 누구나
// 재무 데이터라 캐시 금지(no-store). 누가 언제 무엇을 받았는지 서버 로그와 변경 기록에 남긴다
// 채권·채무 다운로드는 /api/management/ledger/export
import {
  exportManagementFile,
  ExportTemplateMissingError,
  ManagementExportError,
} from "@/modules/management";
import { can, getCurrentUser } from "@/shared/auth";

const NO_STORE = { "Cache-Control": "no-store" };

const text = (status: number, message: string) =>
  new Response(message, {
    status,
    headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
  });

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "view", "management")) {
    return text(403, "권한이 없습니다.");
  }
  const params = new URL(request.url).searchParams;
  try {
    const file = await exportManagementFile(
      params.get("kind"),
      params.get("period"),
      { id: user.id, loginId: user.loginId, name: user.name },
    );
    console.info(
      `[mgmt-export] user=${user.loginId} kind=${file.kind} period=${file.period} sheets=${file.sheetNames.join(",")}`,
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
    if (error instanceof ManagementExportError) {
      return text(error.status, error.message);
    }
    if (error instanceof ExportTemplateMissingError) {
      console.error(`[mgmt-export] 양식 파일 없음: ${error.filePath}`);
      return text(503, error.message);
    }
    console.error("[mgmt-export] 실패", error);
    return text(500, "엑셀 파일을 만들지 못했습니다. 잠시 후 다시 시도하세요.");
  }
}
