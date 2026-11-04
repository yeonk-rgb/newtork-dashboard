// 가격 화면 3개 (서버) — 부품 가격 관리 / 출장지별 가격 조회 / 출장지 비교 분석. 고른 부품·출장지는 주소(?part=, ?site=)
import "server-only";

import { getCurrentUser } from "@/shared/auth";
import { AuditNotice } from "@/shared/ui/audit-notice";
import { Forbidden } from "@/shared/ui/forbidden";
import { pageTitleClass } from "@/shared/ui/styles";

import { ReadOnlyBadge } from "../read-only-badge";
import { serviceAbilities } from "../rules";
import { defaultPart, defaultSite } from "./compute";
import { loadPriceData } from "./load-prices";
import { PriceBySite } from "./price-by-site";
import { PriceCompare } from "./price-compare";
import { PriceManage } from "./price-manage";

type Sp = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : "";

async function screen(kind: "manage" | "by-site" | "compare", sp: Sp) {
  const user = await getCurrentUser();
  const a = serviceAbilities(user);
  if (!a.canView) return <Forbidden user={user} />;
  const data = await loadPriceData();
  const hasPart = (id: string) => data.parts.some((p) => p.id === id);
  const hasSite = (id: string) => data.sites.some((s) => s.id === id);
  const title = {
    manage: "부품 가격 관리",
    "by-site": "출장지별 가격 조회",
    compare: "출장지 비교 분석",
  }[kind];
  let body: React.ReactNode;
  if (kind === "by-site") {
    const siteId = hasSite(str(sp.site))
      ? str(sp.site)
      : defaultSite(data.sites, data.prices);
    body = <PriceBySite key={siteId} data={data} siteId={siteId} />;
  } else {
    const fallback =
      kind === "manage"
        ? (data.parts[0]?.id ?? null)
        : defaultPart(data.parts, data.prices);
    const partId = hasPart(str(sp.part)) ? str(sp.part) : fallback;
    body =
      kind === "manage" ? (
        <PriceManage
          key={partId}
          data={data}
          partId={partId}
          canEdit={a.canEdit}
          canHide={a.canHide}
        />
      ) : (
        <PriceCompare key={partId} data={data} partId={partId} />
      );
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className={`${pageTitleClass} flex flex-wrap items-center gap-3`}>
          {title}
          {kind === "manage" && !a.canEdit && (
            <ReadOnlyBadge note="입력·수정은 팀장만 할 수 있습니다" />
          )}
        </h1>
        {kind === "manage" && <AuditNotice />}
      </div>
      {body}
    </div>
  );
}

export const PriceManageScreen = ({ searchParams }: { searchParams: Sp }) =>
  screen("manage", searchParams);
export const PriceBySiteScreen = ({ searchParams }: { searchParams: Sp }) =>
  screen("by-site", searchParams);
export const PriceCompareScreen = ({ searchParams }: { searchParams: Sp }) =>
  screen("compare", searchParams);
