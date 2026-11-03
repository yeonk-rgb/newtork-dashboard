// 사업구분 지정 화면 (서버) — 산업 분야는 엑셀에 없어 수주번호마다 사람이 지정 (생산팀 specs/07 Q3)
import "server-only";

import Link from "next/link";

import { getCurrentUser } from "@/shared/auth";
import { AuditNotice } from "@/shared/ui/audit-notice";
import { Forbidden } from "@/shared/ui/forbidden";
import {
  buttonPrimaryClass,
  labelClass,
  pageTitleClass,
} from "@/shared/ui/styles";

import { productionAbilities } from "../rules";
import { CategoryTable } from "./category-table";
import { loadOrders } from "./load-orders";

const n = (v: number) => v.toLocaleString("ko-KR");

export async function CategoriesScreen({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  const abilities = productionAbilities(user);
  if (!abilities.canView) return <Forbidden user={user} />;

  const q =
    typeof searchParams.q === "string"
      ? searchParams.q.trim().slice(0, 100)
      : "";
  const onlyNone = searchParams.category === "none";
  const { rows, total, unclassified, recordsWithoutOrder } = await loadOrders({
    q,
    onlyNone,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className={pageTitleClass}>사업구분 지정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          제조내역 엑셀에는 산업 분야가 없어 수주번호마다 직접 지정합니다.
          지정하면 같은 수주번호의 일련번호 전체에 적용되고, 나중에 올라오는
          같은 수주번호에도 자동으로 적용됩니다. 메인 화면 산업 분야별 판매량에
          쓰입니다.
        </p>
        <AuditNotice />
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-card border bg-card p-6"
      >
        <label className="flex flex-col gap-1">
          <span className={labelClass}>검색</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="수주번호·판매처·최종발주처"
            className="h-10 w-72 rounded-lg border border-input bg-background px-3 text-sm"
          />
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="category"
            value="none"
            defaultChecked={onlyNone}
            className="size-4 accent-primary"
          />
          미분류만
        </label>
        <button type="submit" className={buttonPrimaryClass}>
          조회
        </button>
        <Link href="?" className="text-sm text-primary hover:underline">
          초기화
        </Link>
      </form>

      <section className="rounded-card border bg-card py-6">
        <p className="px-6 pb-3 text-sm text-muted-foreground">
          수주번호 {n(total)}건 중 미분류 {n(unclassified)}건 · 표시{" "}
          {n(rows.length)}건
          {recordsWithoutOrder > 0 &&
            ` · 수주번호가 없는 제조내역 ${n(recordsWithoutOrder)}행은 지정할 수 없습니다`}
        </p>
        {rows.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">
            조건에 맞는 수주번호가 없습니다.
          </p>
        ) : (
          <CategoryTable
            key={`${q}|${onlyNone}`}
            rows={rows}
            canEdit={abilities.canEdit}
          />
        )}
      </section>
    </div>
  );
}
