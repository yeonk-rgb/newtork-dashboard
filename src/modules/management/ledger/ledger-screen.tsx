// 채권·채무 관리 화면 (서버): 경영지원 view 권한이면 열람, 행 추가·수정은 edit, 숨김·복구는 confirm
import "server-only";

import { can, getCurrentUser } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";
import { pageTitleClass } from "@/shared/ui/styles";

import { getTodayKst } from "../data/load-summary-input";
import { parseKindParam } from "./labels";
import { LedgerManager } from "./ledger-manager";
import { loadLedgerData } from "./load-ledger";
import {
  canManageHiddenLedger,
  formatLedgerMonth,
  isFutureMonth,
  monthOfDate,
  parseLedgerMonth,
  toDateOnly,
} from "./rules";

export async function LedgerScreen({
  month,
  tab,
  hidden,
}: {
  month: string | undefined;
  tab: string | undefined;
  hidden: string | undefined;
}) {
  const user = await getCurrentUser();
  if (!user || !can(user, "view", "management"))
    return <Forbidden user={user} />;

  // getTodayKst()(connection)를 DB 조회보다 먼저 — 요청 시점 렌더링 표시가 앞서야 prerender 에러가 나지 않는다
  const today = toDateOnly(await getTodayKst());
  const thisMonth = monthOfDate(today);
  const ym = parseLedgerMonth(month) ?? thisMonth;

  if (isFutureMonth(ym, today)) {
    return (
      <p className="rounded-card border bg-card p-6 text-center text-sm">
        미래 달({ym.year}년 {ym.month}월)은 볼 수 없습니다.{" "}
        <a className="text-primary underline" href="/management/ledger">
          이번 달로 이동
        </a>
      </p>
    );
  }

  // 숨긴 행은 팀장(confirm)에게만 내려보낸다
  const data = await loadLedgerData(ym, canManageHiddenLedger(user));

  return (
    <div className="space-y-6">
      <div>
        <h1 className={pageTitleClass}>채권·채무 관리</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          경영지원_관리 엑셀 양식을 옮긴 화면입니다. 기준년월별 거래처 잔액이며,
          미수금 관리·대시보드와는 아직 연결되지 않습니다 (고객사 확인 중
          05-22번).
        </p>
      </div>
      <LedgerManager
        key={formatLedgerMonth(ym)}
        user={user}
        month={formatLedgerMonth(ym)}
        maxMonth={formatLedgerMonth(thisMonth)}
        rows={data.rows}
        hiddenRows={data.hiddenRows}
        today={today}
        initialKind={parseKindParam(tab)}
        initialShowHidden={hidden === "1"}
      />
    </div>
  );
}
