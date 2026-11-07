// 단가 화면 4개 (서버) — 친구 우민영 저장소 "단가" 메뉴 + 2026-11-05 담당자 피드백
// 부품별 비교 / 출장지별 비교 / 단가 데이터 업로드 / 부품 추가 (단가 직접 입력·제품 단가·원가 탭은 피드백으로 없앰)
import "server-only";

import Link from "next/link";

import { getCurrentUser } from "@/shared/auth";
import { cn } from "@/shared/lib/utils";
import { AuditNotice } from "@/shared/ui/audit-notice";
import { Forbidden } from "@/shared/ui/forbidden";
import { pageTitleClass, pillClass } from "@/shared/ui/styles";

import { ReadOnlyBadge } from "../read-only-badge";
import { serviceAbilities } from "../rules";
import { CompaniesCompare } from "./companies-compare";
import {
  companyComparison,
  itemQuotes,
  itemRows,
  matchesQuery,
} from "./compute";
import { loadUnitPriceData, type UnitPriceData } from "./load-unit-prices";
import { NewItemForm } from "./new-item-form";
import { PartsCompare } from "./parts-compare";
import { UploadHistory } from "./upload-history";
import { UploadPanel } from "./upload-panel";

type Sp = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v.trim() : "";

export const UNIT_PRICE_TABS = [
  { href: "/service/unit-prices", label: "부품별 비교" },
  { href: "/service/unit-prices/companies", label: "출장지별 비교" },
  { href: "/service/unit-prices/upload", label: "단가 데이터 업로드" },
  { href: "/service/unit-prices/new", label: "부품 추가" },
  { href: "/service/unit-prices/uploads", label: "업로드 이력" },
] as const;

type Tab = (typeof UNIT_PRICE_TABS)[number]["href"];

const categoriesOf = (data: UnitPriceData) => [
  ...new Set(
    data.items.filter((i) => !i.hidden && i.category).map((i) => i.category),
  ),
];

async function frame(
  tab: Tab,
  body: (ctx: {
    data: UnitPriceData;
    canEdit: boolean;
    canHide: boolean;
  }) => React.ReactNode,
  editScreen: boolean,
) {
  const user = await getCurrentUser();
  const a = serviceAbilities(user);
  if (!a.canView) return <Forbidden user={user} />;
  const data = await loadUnitPriceData();
  const title = UNIT_PRICE_TABS.find((t) => t.href === tab)!.label;
  return (
    <div className="space-y-4">
      <div>
        <h1 className={`${pageTitleClass} flex flex-wrap items-center gap-3`}>
          {title}
          {!a.canEdit && (
            <ReadOnlyBadge note="입력·수정은 팀장만 할 수 있습니다" />
          )}
          {data.hasSample && (
            <span
              className={cn(pillClass, "bg-warning-soft text-warning-strong")}
            >
              샘플 데이터
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          파트넘버별 뉴토크 기준값과 출장지(업체)별 단가를 비교합니다. 금액은
          부가세 제외.
        </p>
        {editScreen && <AuditNotice />}
      </div>
      <nav aria-label="단가 화면" className="flex flex-wrap gap-1 border-b">
        {UNIT_PRICE_TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.href === tab ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              t.href === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {body({ data, canEdit: a.canEdit, canHide: a.canHide })}
    </div>
  );
}

/** 부품별 비교 — ?q=&category=&hidden=1&part= */
export function PartsCompareScreen({ searchParams: sp }: { searchParams: Sp }) {
  return frame(
    "/service/unit-prices",
    ({ data, canEdit, canHide }) => {
      const filters = {
        q: str(sp.q),
        category: str(sp.category),
        hidden: str(sp.hidden) === "1",
      };
      const all = itemRows(data.items, data.quotes, data.today);
      const rows = all.filter(
        (r) =>
          r.hidden === filters.hidden &&
          (!filters.category || r.category === filters.category) &&
          matchesQuery(r, filters.q),
      );
      // 고른 부품 — 없으면 검색 결과가 1개일 때 그 부품 (친구 앱: 파트넘버로 찾으면 바로 상세)
      const partId = str(sp.part);
      const picked =
        all.find((r) => r.id === partId) ??
        (filters.q && rows.length === 1 ? rows[0] : null);
      return (
        <PartsCompare
          rows={rows}
          categories={categoriesOf(data)}
          filters={filters}
          detail={
            picked
              ? {
                  item: picked,
                  quotes: itemQuotes(picked, data.quotes, data.today),
                }
              : null
          }
          canEdit={canEdit}
          canHide={canHide}
        />
      );
    },
    true,
  );
}

/** 출장지별 비교 — ?category=&company= */
export function CompaniesCompareScreen({
  searchParams: sp,
}: {
  searchParams: Sp;
}) {
  return frame(
    "/service/unit-prices/companies",
    ({ data }) => {
      const category = str(sp.category);
      const { companies, lowCount } = companyComparison(
        data.items.filter((i) => !category || i.category === category),
        data.quotes,
        data.today,
      );
      const company = str(sp.company);
      return (
        <CompaniesCompare
          companies={companies}
          lowCount={lowCount}
          categories={categoriesOf(data)}
          category={category}
          selected={
            companies.some((c) => c.company === company) ? company : null
          }
        />
      );
    },
    false,
  );
}

export function UnitPriceUploadScreen() {
  return frame(
    "/service/unit-prices/upload",
    ({ canEdit }) => <UploadPanel canEdit={canEdit} />,
    true,
  );
}

export function NewPriceItemScreen() {
  return frame(
    "/service/unit-prices/new",
    ({ data, canEdit }) => (
      <>
        <NewItemForm canEdit={canEdit} categories={categoriesOf(data)} />
        <UploadPanel
          canEdit={canEdit}
          fixedKind="items"
          title="엑셀·CSV로 여러 개 추가"
        />
      </>
    ),
    true,
  );
}

export function UnitPriceUploadsScreen() {
  return frame("/service/unit-prices/uploads", () => <UploadHistory />, false);
}
