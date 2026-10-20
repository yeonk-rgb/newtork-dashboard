// 엑셀 업로드 양식 다운로드 (경영지원 열람 권한)
import { buildTemplate, TEMPLATE_FILE_NAME } from "@/modules/management";
import { can, getCurrentUser } from "@/shared/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "view", "management")) {
    return new Response("권한이 없습니다.", { status: 403 });
  }
  const body = await buildTemplate();
  return new Response(body, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="upload-template.xlsx"; filename*=UTF-8''${encodeURIComponent(TEMPLATE_FILE_NAME)}`,
      "Cache-Control": "no-store",
    },
  });
}
