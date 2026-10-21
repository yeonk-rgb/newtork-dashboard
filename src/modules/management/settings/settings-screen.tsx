// 목표·항목 설정 화면 (서버): confirm 권한만, 탭 2개 (?tab=categories)
import "server-only";

import Link from "next/link";

import { can, getCurrentUser } from "@/shared/auth";
import { cn } from "@/shared/lib/utils";
import { Forbidden } from "@/shared/ui/forbidden";

import { getTodayKst } from "../data/load-summary-input";
import { loadYearRange } from "../data/queries";
import { CategoryManager } from "./category-manager";
import { loadCategories, loadTarget } from "./load-settings";
import { TargetForm } from "./target-form";

const TABS = [
  { key: "target", label: "연간 목표" },
  { key: "categories", label: "그 외 지출 항목" },
] as const;

export async function SettingsScreen({
  tab,
  yearParam,
}: {
  tab: string | undefined;
  yearParam: string | undefined;
}) {
  const user = await getCurrentUser();
  if (!user || !can(user, "confirm", "management"))
    return <Forbidden user={user} />;

  const active = tab === "categories" ? "categories" : "target";
  const thisYear = (await getTodayKst()).getUTCFullYear();
  const parsedYear = Number(yearParam);
  const year =
    Number.isInteger(parsedYear) &&
    parsedYear >= 2000 &&
    parsedYear <= thisYear + 1
      ? parsedYear
      : thisYear;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">목표·항목 설정</h1>
      <nav aria-label="설정 종류" className="flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={
              t.key === "target"
                ? `/management/targets?year=${year}`
                : "/management/targets?tab=categories"
            }
            aria-current={active === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              active === t.key
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {active === "target" ? (
        <TargetTab year={year} thisYear={thisYear} />
      ) : (
        <CategoriesTab />
      )}
    </div>
  );
}

async function TargetTab({
  year,
  thisYear,
}: {
  year: number;
  thisYear: number;
}) {
  const [data, range] = await Promise.all([
    loadTarget(year),
    loadYearRange(thisYear),
  ]);
  // 내년 목표도 미리 세울 수 있게 올해 + 1년까지
  const years = [...new Set([...range, thisYear + 1, year])].sort();
  return <TargetForm key={year} data={data} years={years} />;
}

async function CategoriesTab() {
  const { rows, version } = await loadCategories();
  return <CategoryManager rows={rows} version={version} />;
}
