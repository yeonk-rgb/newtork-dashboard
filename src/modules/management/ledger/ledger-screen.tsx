// 경영지원 관리 화면 (서버): 경영지원 view 권한이면 열람, 행 추가·수정은 edit, 숨김·복구는 confirm
import "server-only";

import { can, getCurrentUser } from "@/shared/auth";
import { AuditNotice } from "@/shared/ui/audit-notice";
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
import { TERMS } from "../terms";

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
        <h1 className={pageTitleClass}>{TERMS.ledger}</h1>
        <p className="mt-1 text-sm text-foreground">{TERMS.ledgerScope}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          기준년월별 거래처 잔액이며, 잔액은 ERP 잔액 그대로(부가세 포함)
          입력하세요. 외상매출금의 {TERMS.longOverdue} + {TERMS.scheduled}이
          대시보드·리포트의 미수금이 됩니다.
        </p>
        <AuditNotice />
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
