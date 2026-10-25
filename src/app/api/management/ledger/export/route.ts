// 채권·채무 엑셀 다운로드 (?period=2026-10 | 2026-Q4 | 2026) — 경영지원 열람 권한이면 누구나
// 재무 데이터라 캐시 금지(no-store). 누가 언제 어느 기간을 받았는지 서버 로그에 남긴다
import {
  exportLedger,
  LedgerExportError,
  LedgerTemplateMissingError,
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
  const period = new URL(request.url).searchParams.get("period");
  try {
    const file = await exportLedger(period);
    console.info(
      `[ledger-export] user=${user.loginId} period=${file.period} sheets=${file.sheetNames.join(",")} rows=${file.rowCount}`,
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
    if (error instanceof LedgerExportError) {
      return text(error.status, error.message);
    }
    if (error instanceof LedgerTemplateMissingError) {
      console.error(`[ledger-export] 양식 파일 없음: ${error.filePath}`);
      return text(503, error.message);
    }
    console.error("[ledger-export] 실패", error);
    return text(500, "엑셀 파일을 만들지 못했습니다. 잠시 후 다시 시도하세요.");
  }
}
