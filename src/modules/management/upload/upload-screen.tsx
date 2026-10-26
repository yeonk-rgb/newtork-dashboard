// 엑셀 업로드 · 과거 데이터 이관 화면 (서버): 경영지원 열람 권한이면 열람·미리보기, 저장은 관리자·대표·팀장
import "server-only";

import { Download } from "lucide-react";

import { getCurrentUser, loadUserNames } from "@/shared/auth";
import { AuditNotice } from "@/shared/ui/audit-notice";
import { Forbidden } from "@/shared/ui/forbidden";

import { getTodayKst } from "../data/load-summary-input";
import { dateTimeLabel } from "../ai/load-comment";
import { uploadAbilities } from "./rules";
import { loadRecentUploads } from "./save-upload";
import { UploadPanel } from "./upload-panel";
import {
  buttonSecondaryClass,
  cardTitleClass,
  pageTitleClass,
} from "@/shared/ui/styles";

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
  const nameOf = await loadUserNames(uploads.map((u) => u.createdById));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={pageTitleClass}>엑셀 업로드 · 과거 데이터 이관</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            기존 엑셀(수금 등) 파일을 올려 한 번에 반영합니다. 저장 전
            미리보기로 확인할 수 있습니다. 금액은 공급가액(부가세 제외) 원
            단위로 적어 주세요.
          </p>
          <AuditNotice />
        </div>
        <a
          href="/api/management/upload-template"
          download
          className={buttonSecondaryClass}
        >
          <Download className="size-4" aria-hidden />
          업로드 양식 다운로드
        </a>
      </div>

      <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map((text, i) => (
          <li
            key={i}
            className="flex gap-4 rounded-card border bg-card p-6 text-sm"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
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

      <section className="rounded-card border bg-card p-6">
        <h2 className={`mb-4 ${cardTitleClass}`}>최근 업로드</h2>
        {uploads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            아직 업로드한 기록이 없습니다.
          </p>
        ) : (
          <table className="w-full text-sm [&_td]:px-3 [&_th]:px-3">
            <caption className="sr-only">최근 업로드 이력</caption>
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-3 text-left font-medium">일시</th>
                <th className="py-3 text-left font-medium">올린 사람</th>
                <th className="py-3 text-left font-medium">파일</th>
                <th className="py-3 text-right font-medium">저장 행</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-3 tabular-nums">
                    {dateTimeLabel(u.createdAt)}
                  </td>
                  <td className="py-3">{nameOf(u.createdById)}</td>
                  <td className="py-3">
                    {(u.fileNames as string[]).join(", ")}
                    {ledgerUploadLabel(u.detail) && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {ledgerUploadLabel(u.detail)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right tabular-nums">
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

/** 채권·채무 엑셀 이관 이력이면 "채권·채무 2026-10 · 덮어쓰기" (mgmt_data_upload.detail) */
function ledgerUploadLabel(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as {
    kind?: unknown;
    year?: unknown;
    month?: unknown;
    mode?: unknown;
  };
  if (
    d.kind !== "ledger" ||
    typeof d.year !== "number" ||
    typeof d.month !== "number"
  ) {
    return null;
  }
  const month = `${d.year}-${String(d.month).padStart(2, "0")}`;
  return `채권·채무 ${month} · ${d.mode === "overwrite" ? "덮어쓰기" : "추가"}`;
}
