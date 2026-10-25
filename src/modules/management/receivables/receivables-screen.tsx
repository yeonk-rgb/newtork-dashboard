// 미수금 관리 화면 (서버): 경영지원 view 권한이면 열람, 등록·수정·수금은 edit, 숨김·복구·수금 완료 건 수정은 confirm
import "server-only";

import Link from "next/link";

import { can, getCurrentUser } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";

import { getTodayKst } from "../data/load-summary-input";
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
  const data = await loadReceivablesData(canManageHidden(user));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className={pageTitleClass}>미수금 관리</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            경과일은 발생일부터 셉니다 (고객사 확인 중 05-17번). 대시보드
            미수금은 선택한 기간의 마지막 날(진행 중인 기간은 오늘) 기준
            잔액이라, 오늘 등록·수금한 건은 진행 중인 기간(이번 달·이번 분기)
            화면에 반영됩니다.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/management#receivables"
            className="text-xs text-primary hover:underline"
          >
            미수금 통계 보기 →
          </Link>
          {/* 미수금 엑셀 — 기준일 = 기간 말일(진행 중이면 오늘), 대시보드 KPI 와 같음 */}
          <ManagementExportMenu
            kind="receivables"
            file={{ ko: "미수금", ascii: "receivables" }}
            options={receivablesExportOptions(today)}
            note="기준일 = 기간 말일 (진행 중인 기간은 오늘). 숨긴 건은 빠집니다."
          />
        </div>
      </div>
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
