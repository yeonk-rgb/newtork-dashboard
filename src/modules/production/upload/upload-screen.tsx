// 제조내역 엑셀 업로드 화면 (서버) — 생산 열람 권한이면 입력까지 (생산팀 규칙)
import "server-only";

import { getCurrentUser, loadUserNames } from "@/shared/auth";
import { kstDateTime } from "@/shared/format/date-time";
import { AuditNotice } from "@/shared/ui/audit-notice";
import { Forbidden } from "@/shared/ui/forbidden";
import { cardTitleClass, pageTitleClass } from "@/shared/ui/styles";

import { ReadOnlyBadge } from "../read-only-badge";
import { productionAbilities } from "../rules";
import { loadRecentBatches } from "./save-upload";
import { UploadPanel } from "./upload-panel";

const n = (v: number) => v.toLocaleString("ko-KR");

export async function ProductionUploadScreen() {
  const user = await getCurrentUser();
  const abilities = productionAbilities(user);
  if (!abilities.canView) return <Forbidden user={user} />;

  const batches = await loadRecentBatches();
  const nameOf = await loadUserNames(batches.map((b) => b.uploadedById));

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`${pageTitleClass} flex flex-wrap items-center gap-3`}>
          제조내역 엑셀 업로드
          {!abilities.canEdit && (
            <ReadOnlyBadge note="업로드는 팀장만 할 수 있습니다" />
          )}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          제조내역 엑셀을 올리면 새 일련번호는 저장하고, 값이 바뀐 기존 행은
          고른 것만 덮어씁니다. 같은 파일은 두 번 올릴 수 없습니다.
          수량·사업구분은 엑셀에 없으므로 제조내역·사업구분 화면에서 입력합니다.
        </p>
        <AuditNotice />
      </div>

      <UploadPanel canEdit={abilities.canEdit} />

      <section className="rounded-card border bg-card p-6">
        <h2 className={cardTitleClass}>업로드 이력 (최근 20건)</h2>
        {batches.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            아직 올린 파일이 없습니다.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
                  {[
                    "일시",
                    "파일명",
                    "올린 사람",
                    "새로 저장",
                    "덮어씀",
                    "변경 없음",
                    "덮어쓰지 않음",
                    "건너뜀",
                    "오류",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`px-3 py-2 font-medium ${i >= 3 ? "text-right" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="px-3 py-2 tabular-nums">
                      {kstDateTime(b.uploadedAt)}
                    </td>
                    <td className="px-3 py-2">{b.fileName}</td>
                    <td className="px-3 py-2">{nameOf(b.uploadedById)}</td>
                    {[
                      b.createdCount,
                      b.overwrittenCount,
                      b.unchangedCount,
                      b.keptCount,
                      b.skippedCount,
                      b.errorCount,
                    ].map((v, i) => (
                      <td key={i} className="px-3 py-2 text-right tabular-nums">
                        {n(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
