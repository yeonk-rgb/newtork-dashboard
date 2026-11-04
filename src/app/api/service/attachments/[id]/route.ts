// 출장보고서 첨부 받기 — 공개 주소 없이 이 경로로만 (서비스 열람 권한 확인, 친구 AttachmentView 그대로)
import { getAttachmentFile } from "@/modules/service";

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/service/attachments/[id]">,
) {
  const { id } = await params;
  const download = new URL(request.url).searchParams.get("download") === "1";
  const file = await getAttachmentFile(id);
  if (file === "forbidden") {
    return new Response("서비스팀 자료를 볼 권한이 없습니다.", { status: 403 });
  }
  if (!file)
    return new Response("첨부 파일을 찾을 수 없습니다.", { status: 404 });
  return new Response(new Uint8Array(file.content), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
