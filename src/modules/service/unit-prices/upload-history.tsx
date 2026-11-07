// 업로드 이력 (서버) — 친구 우민영 저장소 "업로드 이력"(단가 탭). 따로 표를 두지 않고 변경 이력(audit_log)의 업로드 요약 기록을 읽는다
import "server-only";

import { loadUserNames } from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import { kstDateTime } from "@/shared/format/date-time";
import { cardTitleClass } from "@/shared/ui/styles";

const UPLOAD_SCREEN = "service-unit-price-upload";

type Meta = Record<string, unknown>;
const num = (m: Meta, k: string) =>
  typeof m[k] === "number" ? (m[k] as number) : 0;
const str = (m: Meta, k: string) =>
  typeof m[k] === "string" ? (m[k] as string) : "";

export async function UploadHistory() {
  const logs = await prisma.auditLog.findMany({
    where: { area: "service", screen: UPLOAD_SCREEN },
    orderBy: { occurredAt: "desc" },
    take: 50,
  });
  const nameOf = await loadUserNames(logs.map((l) => l.actorId));
  return (
    <section className="rounded-card border bg-card p-6">
      <h2 className={cardTitleClass}>업로드 이력</h2>
      <p className="mt-1 mb-4 text-xs text-muted-foreground">
        단가 데이터 업로드(부품 단가표·출장지별 단가·부품 추가의 엑셀)를 최근
        50건까지 보여 줍니다. 전체 기록은 경영지원 &gt; 변경 이력에서 볼 수
        있습니다.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">일시</th>
              <th className="px-3 py-2 font-medium">올린 사람</th>
              <th className="px-3 py-2 font-medium">자료</th>
              <th className="px-3 py-2 font-medium">파일</th>
              <th className="px-3 py-2 text-right font-medium">새로</th>
              <th className="px-3 py-2 text-right font-medium">덮어씀</th>
              <th className="px-3 py-2 text-right font-medium">새 부품</th>
              <th className="px-3 py-2 text-right font-medium">변경 없음</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const m = (l.meta ?? {}) as Meta;
              return (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {kstDateTime(l.occurredAt)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {nameOf(l.actorId)}
                  </td>
                  <td className="px-3 py-2">{str(m, "kind")}</td>
                  <td className="px-3 py-2 text-xs break-all">
                    {str(m, "fileName")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {num(m, "created").toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {num(m, "overwritten").toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {num(m, "newParts").toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                    {num(m, "unchanged").toLocaleString("ko-KR")}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  아직 올린 파일이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
