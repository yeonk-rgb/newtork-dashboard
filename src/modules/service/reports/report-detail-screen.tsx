// 출장보고서 상세 + 첨부 (서버) — 친구 저장소 ServiceReportDetailView.vue 그대로. 삭제 대신 숨김
// 제품 일련번호 → 생산 일련번호 검색 (생산 열람 권한이 있을 때만 링크)
import "server-only";

import Link from "next/link";

import { getCurrentUser, loadUserNames } from "@/shared/auth";
import { kstDateTime } from "@/shared/format/date-time";
import { cn } from "@/shared/lib/utils";
import { Forbidden } from "@/shared/ui/forbidden";
import {
  buttonPrimaryClass,
  pageTitleClass,
  pillClass,
} from "@/shared/ui/styles";

import { won } from "../labels";
import { ReadOnlyBadge } from "../read-only-badge";
import { regionLabel } from "../regions/regions";
import { serviceAbilities } from "../rules";
import { AttachmentPanel } from "./attachment-panel";
import { HideReportButton } from "./hide-report-button";
import { loadReport } from "./load-reports";
import { billingPill } from "./reports-screen";

const v = (x: string | number | null | undefined) =>
  x === null || x === undefined || x === "" ? "-" : x;
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function Section({ title }: { title: string }) {
  return (
    <h3 className="mt-5 mb-2.5 border-b pb-1.5 text-sm font-bold text-primary">
      {title}
    </h3>
  );
}

function Info({ rows }: { rows: [string, React.ReactNode, boolean?][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 md:grid-cols-3">
      {rows.map(([dt, dd, wide]) => (
        <div key={dt} className={cn(wide && "col-span-2")}>
          <dt className="text-xs font-medium text-muted-foreground">{dt}</dt>
          <dd className="text-sm font-medium break-words">{dd}</dd>
        </div>
      ))}
    </dl>
  );
}

export async function ReportDetailScreen({ id }: { id: string }) {
  const user = await getCurrentUser();
  const abilities = serviceAbilities(user);
  if (!abilities.canView) return <Forbidden user={user} />;
  const report = await loadReport(id);
  if (!report) {
    return (
      <p
        role="alert"
        className="rounded-lg bg-danger-soft px-4 py-2 text-sm text-danger-strong"
      >
        출장보고서를 찾을 수 없습니다.
      </p>
    );
  }
  const nameOf = await loadUserNames([
    report.createdById,
    report.updatedById,
    ...report.attachments.map((a) => a.uploadedById),
  ]);
  const hidden = report.deletedAt !== null;

  return (
    <div className="space-y-4">
      <h1 className={pageTitleClass}>출장보고서</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/service/reports"
          className="text-sm text-primary hover:underline"
        >
          ← 목록
        </Link>
        {!abilities.canEdit && (
          <ReadOnlyBadge note="수정은 팀장만 할 수 있습니다" />
        )}
        <div className="ml-auto flex gap-2">
          <HideReportButton
            id={report.id}
            hidden={hidden}
            canHide={abilities.canHide}
          />
          {!hidden &&
            (abilities.canEdit ? (
              <Link
                href={`/service/reports/${report.id}/edit`}
                className={buttonPrimaryClass}
              >
                수정
              </Link>
            ) : (
              <span
                aria-disabled
                title="열람 전용 — 수정은 팀장만"
                className={cn(
                  buttonPrimaryClass,
                  "pointer-events-none opacity-50",
                )}
              >
                수정
              </span>
            ))}
        </div>
      </div>
      {hidden && (
        <p
          role="status"
          className="rounded-lg bg-warning-soft px-4 py-2 text-sm text-warning-strong"
        >
          숨긴 출장보고서입니다 — 목록·대시보드 집계에서 빠져 있습니다. [복구]로
          되살릴 수 있습니다.
        </p>
      )}

      <section className="rounded-card border bg-card p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {report.status && (
            <span
              className={cn(pillClass, "bg-success-soft text-success-strong")}
            >
              {report.status}
            </span>
          )}
          <h2 className="text-lg font-bold">{report.title}</h2>
        </div>

        <Section title="출장정보" />
        <Info
          rows={[
            ["요청처 구분", v(report.requestOrgType)],
            ["요청처", v(report.requestOrg)],
            ["현장담당자/연락처", v(report.siteContact)],
            ["출장지 주소", v(report.address)],
            ["지역", regionLabel(report.region, report.sigungu)],
            ["출장 시작일", v(iso(report.tripStart))],
            ["출장 종료일", v(iso(report.tripEnd))],
            ["추가 출장", v(report.extraTrip)],
            ["동행자", report.companions.map((c) => c.name).join(", ") || "-"],
            ["작성일", report.writtenAt ? kstDateTime(report.writtenAt) : "-"],
            ["작성자", v(report.authorName)],
            ["해피콜 예정일", v(iso(report.happyCallDate))],
          ]}
        />

        <Section title="작업 개요" />
        <Info rows={[["작업 구분", v(report.workType)]]} />

        <Section title="제품 목록" />
        <table className="mb-3 w-full text-sm">
          <thead>
            <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
              <th className="px-2 py-1.5 font-medium">모델명</th>
              <th className="px-2 py-1.5 font-medium">사양</th>
              <th className="px-2 py-1.5 font-medium">일련번호</th>
              <th className="px-2 py-1.5 text-right font-medium">수량</th>
            </tr>
          </thead>
          <tbody>
            {report.products.map((p, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-2 py-1.5 font-semibold">{p.modelName}</td>
                <td className="px-2 py-1.5">{v(p.spec)}</td>
                <td className="px-2 py-1.5">
                  {p.serialNo && abilities.canSeeProduction ? (
                    <Link
                      href={`/production/search?serial=${encodeURIComponent(p.serialNo)}`}
                      className="text-primary hover:underline"
                      title="생산 일련번호 검색에서 제조 정보 보기"
                    >
                      {p.serialNo}
                    </Link>
                  ) : (
                    v(p.serialNo)
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {p.quantity === null ? "미입력" : `${p.quantity} 대`}
                </td>
              </tr>
            ))}
            {report.products.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-2 py-1.5 text-xs text-muted-foreground"
                >
                  제품 정보가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <Section title="수리 내역" />
        <div className="grid gap-4 lg:grid-cols-3">
          {(
            [
              ["고장 내용", report.faultDescription],
              ["작업 내용", report.workDescription],
              ["작업 결과", report.workResult],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <div className="text-xs font-medium text-muted-foreground">
                {label}
              </div>
              <p className="text-sm whitespace-pre-wrap">{v(value)}</p>
            </div>
          ))}
        </div>

        <Section title="비고" />
        <Info
          rows={[
            [
              "비용청구 유무",
              report.billing ? billingPill(report.billing) : "미입력",
            ],
            ["견적서 구분", v(report.quoteType)],
            ["견적서", v(report.quote)],
            ["승인자", v(report.approver)],
            ["참조자", v(report.cc)],
            [
              "부품 사용 내역",
              report.parts.length ? (
                <ul className="list-disc pl-4">
                  {report.parts.map((p) => (
                    <li key={p.partId}>
                      <Link
                        href={`/service/prices/compare?part=${p.partId}`}
                        className="hover:text-primary hover:underline"
                        title="출장지별 가격 비교 보기"
                      >
                        {p.name}
                      </Link>
                      <span className="text-xs font-normal text-muted-foreground">
                        {" "}
                        · 수량 {p.quantity ?? "미입력"} · 이 출장지(
                        {report.requestOrg || "요청처 없음"}) 단가{" "}
                        {p.sitePrice === null ? "미입력" : won(p.sitePrice)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                "-"
              ),
              true,
            ],
            ...(report.note
              ? ([
                  [
                    "메모",
                    <span key="n" className="whitespace-pre-wrap">
                      {report.note}
                    </span>,
                    true,
                  ],
                ] as [string, React.ReactNode, boolean][])
              : []),
          ]}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          입력 {nameOf(report.createdById)} ({kstDateTime(report.createdAt)})
          {report.updatedById && (
            <>
              {" "}
              · 최근 수정 {nameOf(report.updatedById)} (
              {kstDateTime(report.updatedAt)})
            </>
          )}
        </p>
      </section>

      <AttachmentPanel
        reportId={report.id}
        canEdit={abilities.canEdit && !hidden}
        attachments={report.attachments.map((a) => ({
          id: a.id,
          kind: a.kind,
          name: a.originalName,
          size: a.size,
          isImage: a.contentType.startsWith("image/"),
          uploadedBy: nameOf(a.uploadedById),
          uploadedAt: kstDateTime(a.uploadedAt),
        }))}
      />
    </div>
  );
}
