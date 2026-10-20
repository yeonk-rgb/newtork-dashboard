// 엑셀 업로드 · 과거 데이터 이관 화면 (서버): 경영지원 열람 권한이면 열람·미리보기, 저장은 관리자·대표·팀장
import "server-only";

import { Download } from "lucide-react";

import { getCurrentUser, userDisplayName } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";

import { getTodayKst } from "../data/load-summary-input";
import { dateTimeLabel } from "../ai/load-comment";
import { uploadAbilities } from "./rules";
import { loadRecentUploads } from "./save-upload";
import { UploadPanel } from "./upload-panel";

const STEPS = [
  "양식을 내려받거나, 기존 엑셀 파일을 그대로 사용합니다. 열 이름이 비슷하면 자동 인식합니다.",
  "파일을 끌어다 놓거나 선택합니다. 시트별로 종류(목표/월별실적/매출내역/미수금)를 판별합니다.",
  "미리보기를 확인하고 [저장]을 누릅니다. 오류가 하나라도 있으면 아무것도 저장되지 않습니다.",
];

export async function UploadScreen() {
  const user = await getCurrentUser();
  const abilities = user ? uploadAbilities(user) : null;
  if (!user || !abilities?.canView) return <Forbidden user={user} />;

  const today = await getTodayKst();
  const thisYear = today.getUTCFullYear();
  const uploads = await loadRecentUploads();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            엑셀 업로드 · 과거 데이터 이관
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            기존 엑셀(수금 등) 파일을 올려 한 번에 반영합니다. 저장 전
            미리보기로 확인할 수 있습니다.
          </p>
        </div>
        <a
          href="/api/management/upload-template"
          download
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted"
        >
          <Download className="size-4" aria-hidden />
          업로드 양식 다운로드
        </a>
      </div>

      <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {STEPS.map((text, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-lg border bg-card p-4 text-sm"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
              {i + 1}
            </span>
            <span className="leading-relaxed">{text}</span>
          </li>
        ))}
      </ol>

      <UploadPanel
        thisYear={thisYear}
        canSave={abilities.canSave}
        notice={abilities.notice}
      />

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">최근 업로드</h2>
        {uploads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            아직 업로드한 기록이 없습니다.
          </p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">최근 업로드 이력</caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 text-left font-normal">일시</th>
                <th className="py-1.5 text-left font-normal">올린 사람</th>
                <th className="py-1.5 text-left font-normal">파일</th>
                <th className="py-1.5 text-right font-normal">저장 행</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-1.5 tabular-nums">
                    {dateTimeLabel(u.createdAt)}
                  </td>
                  <td className="py-1.5">{userDisplayName(u.createdById)}</td>
                  <td className="py-1.5">
                    {(u.fileNames as string[]).join(", ")}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {u.savedRows}행
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
