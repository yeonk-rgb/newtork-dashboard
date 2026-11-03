// 제조내역 화면 (서버) — 필터는 주소(GET 폼), 50행씩. 생산 열람 권한이면 수정·숨김까지 (생산팀 규칙)
import "server-only";

import Link from "next/link";

import { getCurrentUser, loadUserNames } from "@/shared/auth";
import { INDUSTRIES } from "@/shared/contracts/production";
import { kstDateTime } from "@/shared/format/date-time";
import { AuditNotice } from "@/shared/ui/audit-notice";
import { Forbidden } from "@/shared/ui/forbidden";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  labelClass,
  pageTitleClass,
} from "@/shared/ui/styles";

import { UNCLASSIFIED_LABEL } from "../labels";
import { ReadOnlyBadge } from "../read-only-badge";
import { productionAbilities } from "../rules";
import { COLUMNS, DATE_FIELDS } from "../upload/columns";
import type { ParseWarning } from "../upload/parse-sheet";
import {
  PAGE_SIZE,
  loadRecordPage,
  parseRecordFilter,
  recordSearch,
  type RecordRowData,
} from "./load-records";
import { RecordTable, type RecordRow } from "./record-table";

const inputClass =
  "h-10 rounded-lg border border-input bg-background px-3 text-sm";

function toRow(r: RecordRowData, nameOf: (id: string) => string): RecordRow {
  const values = Object.fromEntries(
    COLUMNS.map((c) => {
      const v = (r as Record<string, unknown>)[c.field];
      return [
        c.field,
        DATE_FIELDS.has(c.field)
          ? v instanceof Date
            ? v.toISOString().slice(0, 10)
            : ""
          : String(v ?? ""),
      ];
    }),
  );
  return {
    ...(values as unknown as Omit<RecordRow, "id">),
    id: r.id,
    sheetName: r.sheetName,
    serialNo: r.serialNo,
    quantity: r.quantity === null ? "" : String(r.quantity),
    category: r.category,
    sourceRow: r.sourceRow,
    fileName: r.batch.fileName,
    updatedAt: r.updatedAt.toISOString(),
    updatedBy: nameOf(r.updatedById),
    updatedAtLabel: kstDateTime(r.updatedAt),
    hidden: r.deletedAt !== null,
    warnings: (r.importWarnings as ParseWarning[]).map((w) => ({
      field: w.field,
      message: w.message,
    })),
  };
}

export async function RecordsScreen({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  const abilities = productionAbilities(user);
  if (!abilities.canView) return <Forbidden user={user} />;

  const filter = parseRecordFilter(searchParams);
  const { total, rows, models } = await loadRecordPage(filter);
  const nameOf = await loadUserNames(rows.map((r) => r.updatedById));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`${pageTitleClass} flex flex-wrap items-center gap-3`}>
          제조내역{filter.hidden ? " — 숨긴 행" : ""}
          {!abilities.canEdit && (
            <ReadOnlyBadge note="수정·숨기기는 팀장만 할 수 있습니다" />
          )}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          엑셀 1행 = 일련번호 1개. 수량은 엑셀에 없어 확인된 것만 [수정]에서
          입력합니다 — 생산 실적은 출고일과 수량이 모두 있는 행만 셉니다.
        </p>
        <AuditNotice />
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-card border bg-card p-6"
      >
        {filter.hidden && <input type="hidden" name="hidden" value="1" />}
        <label className="flex flex-col gap-1">
          <span className={labelClass}>검색</span>
          <input
            name="q"
            defaultValue={filter.q}
            placeholder="일련번호·수주번호·판매처·발주처·사업명"
            className={`${inputClass} w-72`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>모델명</span>
          <select
            name="model"
            defaultValue={filter.model}
            className={inputClass}
          >
            <option value="">전체</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>사업구분</span>
          <select
            name="category"
            defaultValue={filter.category}
            className={inputClass}
          >
            <option value="">전체</option>
            {INDUSTRIES.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
              </option>
            ))}
            <option value="none">{UNCLASSIFIED_LABEL}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>출고 여부</span>
          <select
            name="shipped"
            defaultValue={filter.shipped}
            className={inputClass}
          >
            <option value="">전체</option>
            <option value="yes">출고일 있음</option>
            <option value="none">출고일 없음</option>
          </select>
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className={labelClass}>출고일 기간</legend>
          <div className="flex items-center gap-1">
            <input
              type="date"
              name="from"
              defaultValue={filter.shippedFrom}
              aria-label="출고일 시작"
              className={inputClass}
            />
            <span aria-hidden>~</span>
            <input
              type="date"
              name="to"
              defaultValue={filter.shippedTo}
              aria-label="출고일 끝"
              className={inputClass}
            />
          </div>
        </fieldset>
        <button type="submit" className={buttonPrimaryClass}>
          조회
        </button>
        <Link
          href={filter.hidden ? "?hidden=1" : "?"}
          className={buttonSecondaryClass}
        >
          초기화
        </Link>
        <Link
          href={filter.hidden ? "/production/records" : "?hidden=1"}
          className="ml-auto text-sm text-primary hover:underline"
        >
          {filter.hidden ? "← 제조내역으로" : "숨긴 행 보기"}
        </Link>
      </form>

      <section className="rounded-card border bg-card py-6">
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 pb-3">
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString("ko-KR")}행 · {filter.page}/{pages}쪽
          </p>
          <Link href="/production/upload" className={buttonSecondaryClass}>
            엑셀 업로드
          </Link>
        </div>
        <RecordTable
          rows={rows.map((r) => toRow(r, nameOf))}
          canEdit={abilities.canEdit}
          canHide={abilities.canHide}
        />
        {pages > 1 && (
          <nav
            aria-label="쪽 이동"
            className="flex items-center justify-center gap-3 px-6 pt-4 text-sm"
          >
            {filter.page > 1 ? (
              <Link
                href={`?${recordSearch(filter, filter.page - 1)}`}
                className="text-primary hover:underline"
              >
                ← 이전
              </Link>
            ) : (
              <span className="text-muted-foreground">← 이전</span>
            )}
            <span className="tabular-nums">
              {filter.page} / {pages}
            </span>
            {filter.page < pages ? (
              <Link
                href={`?${recordSearch(filter, filter.page + 1)}`}
                className="text-primary hover:underline"
              >
                다음 →
              </Link>
            ) : (
              <span className="text-muted-foreground">다음 →</span>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
