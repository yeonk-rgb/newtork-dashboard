// 미수금 관리 화면 (서버): 경영지원 view 권한이면 열람, 등록·수정·수금은 edit, 숨김·복구·수금 완료 건 수정은 confirm
import "server-only";

import Link from "next/link";

import { can, getCurrentUser } from "@/shared/auth";
import { AuditNotice } from "@/shared/ui/audit-notice";
import { Forbidden } from "@/shared/ui/forbidden";

import { getTodayKst } from "../data/load-summary-input";
import { loadArEntries, loadReceivables } from "../data/queries";
import { computeArReceivables } from "../metrics/ar-receivables";
import { computeItemReceivables } from "../metrics/receivables";
import { formatAmount } from "@/shared/format/money";
import { loadReceivablesData } from "./load-receivables";
import { ReceivablesManager } from "./receivables-manager";
import { canManageHidden, parseReceivableTab, toDateOnly } from "./rules";
import { pageTitleClass } from "@/shared/ui/styles";

import { ManagementExportMenu } from "../export/management-export-menu";

export async function ReceivablesScreen({
  tab,
  query,
  hidden,
}: {
  tab: string | undefined;
  query: string | undefined;
  hidden: string | undefined;
}) {
  const user = await getCurrentUser();
  if (!user || !can(user, "view", "management"))
    return <Forbidden user={user} />;

  // getTodayKst()(connection)를 DB 조회보다 먼저 — 요청 시점 렌더링 표시가 앞서야 prerender 에러가 나지 않는다
  const today = await getTodayKst();
  // 숨긴 건은 팀장(confirm)에게만 내려보낸다
  const [data, arEntries, items] = await Promise.all([
    loadReceivablesData(canManageHidden(user)),
    loadArEntries(today.getUTCFullYear()),
    loadReceivables(),
  ]);
  // 대시보드 미수금 = 채권·채무 외상매출금 (2026-10-26) — 올해 입력이 있는 마지막 달과 이 화면 합계를 같은 기준일로 비교
  const ar = computeArReceivables(
    arEntries,
    { unit: "year", year: today.getUTCFullYear() },
    today,
    1,
  );
  const itemTotal = computeItemReceivables(items, ar.asOf, 1).total;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className={pageTitleClass}>미수금 관리 (건별 참고)</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            건별 메모·수금 기록용 화면입니다. 경과일은 발생일부터 셉니다.
          </p>
          <AuditNotice />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/management#receivables"
            className="text-xs text-primary hover:underline"
          >
            대시보드 미수금 보기 →
          </Link>
          {/* 미수금 관리(건별 참고) 엑셀 — 기준일 = 기간 말일(진행 중이면 오늘). 대시보드 미수금(외상매출금)과 기준이 다름 */}
          <ManagementExportMenu
            kind="receivables"
            file={{ ko: "미수금", ascii: "receivables" }}
            options={receivablesExportOptions(today)}
            note="이 화면의 건별 목록 (기준일 = 기간 말일, 진행 중인 기간은 오늘). 숨긴 건은 빠집니다. 대시보드 미수금은 채권·채무 외상매출금 기준입니다."
          />
        </div>
      </div>
      <BasisNotice
        arMonth={ar.month}
        arTotal={ar.total}
        itemTotal={itemTotal}
        asOf={ar.asOf}
      />
      <ReceivablesManager
        user={user}
        rows={data.rows}
        hiddenRows={data.hiddenRows}
        customerNames={data.customerNames}
        today={toDateOnly(today)}
        initialTab={parseReceivableTab(tab)}
        initialQuery={query ?? ""}
        initialShowHidden={hidden === "1"}
      />
    </div>
  );
}

/** 미수금 엑셀 메뉴: 이번 달(오늘 기준) / 지난달(말일 기준) / 지난 분기(말일 기준) — 기준일은 서버가 min(기간 말일, 오늘) */
function receivablesExportOptions(today: Date) {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const prev =
    month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const quarter = Math.ceil(month / 3);
  const lastQuarter =
    quarter === 1
      ? { year: year - 1, quarter: 4 as const }
      : { year, quarter: (quarter - 1) as 1 | 2 | 3 };
  return [
    {
      label: "이번 달 · 오늘 기준",
      period: { unit: "month" as const, year, month },
    },
    {
      label: `지난달 · ${prev.month}월 말`,
      period: { unit: "month" as const, ...prev },
    },
    {
      label: `지난 분기 · ${lastQuarter.quarter}분기 말`,
      period: { unit: "quarter" as const, ...lastQuarter },
    },
  ];
}

/**
 * 화면 맨 위 안내 (2026-10-26, 05-22): 대시보드·리포트·자금수지 예측은 채권·채무 외상매출금 기준
 * 같은 기준일의 두 합계를 나란히 보여 줘서 어긋나면 바로 보이게 한다 (막지는 않음 — 건별 메모용으로 쓰는 화면)
 */
function BasisNotice({
  arMonth,
  arTotal,
  itemTotal,
  asOf,
}: {
  arMonth: { year: number; month: number } | null;
  arTotal: bigint;
  itemTotal: bigint;
  asOf: Date;
}) {
  const diff = itemTotal - arTotal;
  const date = asOf.toISOString().slice(0, 10);
  return (
    <div
      role="note"
      className="space-y-1 rounded-card border bg-warning-soft px-5 py-4 text-sm"
    >
      <p className="font-medium">
        대시보드·리포트·자금수지 예측의 미수금은{" "}
        <Link
          href={
            arMonth
              ? `/management/ledger?month=${arMonth.year}-${String(arMonth.month).padStart(2, "0")}`
              : "/management/ledger"
          }
          className="text-primary underline"
        >
          채권·채무 관리
        </Link>
        의 외상매출금 기준입니다.
      </p>
      {arMonth ? (
        <p className="tabular-nums">
          {arMonth.year}년 {arMonth.month}월 외상매출금 미수{" "}
          {formatAmount(arTotal)}원 ↔ 이 화면 미수 합계({date} 기준){" "}
          {formatAmount(itemTotal)}원 —{" "}
          {diff === 0n ? (
            "같음"
          ) : (
            <span className="font-semibold text-warning-strong">
              차이 {formatAmount(diff < 0n ? -diff : diff)}원
              {diff > 0n ? " (이 화면이 많음)" : " (이 화면이 적음)"}
            </span>
          )}
        </p>
      ) : (
        <p>올해 채권·채무 외상매출금 입력이 아직 없습니다.</p>
      )}
    </div>
  );
}
