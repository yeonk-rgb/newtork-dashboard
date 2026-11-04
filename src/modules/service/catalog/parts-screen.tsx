// 부품 목록 (서버) — 친구 저장소 ServicePartsView.vue 그대로. 검색·"출장지 가격 없는 부품만"은 주소(GET 폼)
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

import { ReadOnlyBadge } from "../read-only-badge";
import { serviceAbilities } from "../rules";
import { loadParts } from "./load-catalog";
import { PartsTable } from "./parts-table";

const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v.trim() : "";

export async function PartsScreen({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  const a = serviceAbilities(user);
  if (!a.canView) return <Forbidden user={user} />;
  const q = str(searchParams.q).slice(0, 100);
  const noPrice = str(searchParams.price) === "none";
  const hidden = str(searchParams.hidden) === "1";
  const parts = await loadParts({ q, noPrice, hidden });

  return (
    <div className="space-y-4">
      <div>
        <h1 className={`${pageTitleClass} flex flex-wrap items-center gap-3`}>
          부품 목록{hidden ? " — 숨긴 부품" : ""}
          {!a.canEdit && (
            <ReadOnlyBadge note="입력·수정은 팀장만 할 수 있습니다" />
          )}
        </h1>
        <AuditNotice />
      </div>
      <p className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        부품 가격은 출장지마다 다를 수 있어{" "}
        <Link href="/service/prices" className="text-primary hover:underline">
          부품 가격 관리
        </Link>
        에서 출장지별로 입력합니다(출장보고서 PDF에 없는 정보). 여기서는 부품
        이름·메모를 관리하고, 가격이 등록된 출장지 수와 최저~최고 가격을 봅니다.
        교체한 출장지는 그 부품이 들어간 출장보고서의 요청처와 보고서 수입니다.
        부품별 사용 수량이 보고서에 없어{" "}
        <strong className="text-foreground">
          부품 비용 합계는 계산하지 않습니다.
        </strong>
      </p>
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-card border bg-card p-5"
      >
        {hidden && <input type="hidden" name="hidden" value="1" />}
        <label className="flex min-w-56 flex-1 flex-col gap-1">
          <span className={labelClass}>부품명 검색</span>
          <input
            name="q"
            defaultValue={q}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="price"
            value="none"
            defaultChecked={noPrice}
          />
          출장지 가격 없는 부품만
        </label>
        <button type="submit" className={buttonPrimaryClass}>
          조회
        </button>
        <Link
          href={hidden ? "/service/parts" : "?hidden=1"}
          className="ml-auto pb-2 text-sm text-primary hover:underline"
        >
          {hidden ? "← 부품 목록으로" : "숨긴 부품 보기"}
        </Link>
      </form>
      <PartsTable
        parts={parts}
        hidden={hidden}
        canEdit={a.canEdit}
        canHide={a.canHide}
      />
    </div>
  );
}
