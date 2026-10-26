// 채권·채무 엑셀 이관 화면 (서버): 경영지원 edit 권한이면 올리기·추가, confirm 이면 덮어쓰기까지
import "server-only";

import Link from "next/link";

import { can, getCurrentUser } from "@/shared/auth";
import { AuditNotice } from "@/shared/ui/audit-notice";
import { Forbidden } from "@/shared/ui/forbidden";
import { pageTitleClass } from "@/shared/ui/styles";

import { getTodayKst } from "../../data/load-summary-input";
import {
  formatLedgerMonth,
  isFutureMonth,
  monthOfDate,
  parseLedgerMonth,
  toDateOnly,
} from "../rules";
import { ImportPanel } from "./import-panel";
import { importAbilities } from "./rules";

export async function LedgerImportScreen({
  month,
}: {
  month: string | undefined;
}) {
  const user = await getCurrentUser();
  if (!user || !can(user, "view", "management"))
    return <Forbidden user={user} />;

  const today = toDateOnly(await getTodayKst());
  const thisMonth = monthOfDate(today);
  const parsed = parseLedgerMonth(month);
  const ym = parsed && !isFutureMonth(parsed, today) ? parsed : thisMonth;
  const abilities = importAbilities(user);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className={pageTitleClass}>채권·채무 엑셀 가져오기</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            고객사 양식(경영지원_관리.xlsx)을 그대로 올리면 블록 4개를 읽어
            기준년월의 채권·채무로 한 번에 옮깁니다. 미리보기 단계에서는
            아무것도 저장하지 않습니다.
          </p>
          <AuditNotice />
        </div>
        <Link
          href={`/management/ledger?month=${formatLedgerMonth(ym)}`}
          className="shrink-0 text-xs text-primary hover:underline"
        >
          ← 채권·채무 관리
        </Link>
      </div>
      {abilities.canImport ? (
        <ImportPanel
          abilities={abilities}
          initialMonth={formatLedgerMonth(ym)}
          maxMonth={formatLedgerMonth(thisMonth)}
        />
      ) : (
        <p className="rounded-card border bg-card p-6 text-center text-sm text-muted-foreground">
          엑셀 가져오기는 경영지원 수정 권한이 있어야 합니다. (열람만 가능)
        </p>
      )}
    </div>
  );
}
