// 출장지 관리 (서버) — 친구 저장소 SitesView.vue 그대로
import "server-only";

import Link from "next/link";

import { getCurrentUser } from "@/shared/auth";
import { AuditNotice } from "@/shared/ui/audit-notice";
import { Forbidden } from "@/shared/ui/forbidden";
import { pageTitleClass } from "@/shared/ui/styles";

import { ReadOnlyBadge } from "../read-only-badge";
import { serviceAbilities } from "../rules";
import { loadSites } from "./load-catalog";
import { SitesTable } from "./sites-table";

export async function SitesScreen({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  const a = serviceAbilities(user);
  if (!a.canView) return <Forbidden user={user} />;
  const hidden = searchParams.hidden === "1";
  const sites = await loadSites({ hidden });
  return (
    <div className="space-y-4">
      <div>
        <h1 className={`${pageTitleClass} flex flex-wrap items-center gap-3`}>
          출장지 관리{hidden ? " — 숨긴 출장지" : ""}
          {!a.canEdit && (
            <ReadOnlyBadge note="입력·수정은 팀장만 할 수 있습니다" />
          )}
        </h1>
        <AuditNotice />
      </div>
      <p className="text-sm text-muted-foreground">
        출장지 이름은 출장보고서의{" "}
        <strong className="text-foreground">요청처와 같은 글자</strong>여야
        보고서 수와 보고서 상세의 출장지 단가가 연결됩니다. 출장지를 숨기면 그
        출장지의 부품 가격도 함께 숨겨지고, 출장보고서는 그대로 남습니다.{" "}
        <Link
          href={hidden ? "/service/sites" : "?hidden=1"}
          className="text-primary hover:underline"
        >
          {hidden ? "← 출장지 관리로" : "숨긴 출장지 보기"}
        </Link>
      </p>
      <SitesTable
        sites={sites}
        hidden={hidden}
        canEdit={a.canEdit}
        canHide={a.canHide}
      />
    </div>
  );
}
