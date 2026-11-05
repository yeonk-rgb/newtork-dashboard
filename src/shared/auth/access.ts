// 화면 접근 규칙 (메뉴, 이동할 페이지). 판단은 모두 can()에 맡긴다.
import { can, canManageUsers } from "./can";
import type { Action, AppUser, Team } from "./types";

export type NavItem = {
  href: string;
  label: string;
  children?: NavItem[];
  /** 하위 경로에서는 선택 표시하지 않음 (예: 부품 가격 관리 ↔ 출장지별 가격 조회) */
  exact?: boolean;
};

/** 하위 메뉴: 팀의 해당 동작 권한이 있을 때만 보인다 (숨김은 보조 수단 — 실제 차단은 각 페이지) */
type SubRule = {
  href: string;
  label: string;
  action: Action;
  exact?: boolean;
};

type NavRule = { href: string; label: string; children?: SubRule[] } & (
  { team: Team } | { adminOnly: true }
);

const NAV_RULES: NavRule[] = [
  // 메인(전사 요약)은 경영지원팀 열람 권한과 같다
  { href: "/", label: "경영 대시보드", team: "management" },
  {
    href: "/management",
    label: "경영지원",
    team: "management",
    children: [
      { href: "/management", label: "경영지원 상세", action: "view" },
      { href: "/management/entry", label: "월간 입력", action: "edit" },
      {
        href: "/management/receivables",
        // 2026-10-26: 대시보드 미수금은 경영지원 관리 외상매출금 기준 → 이 화면은 건별 참고용
        label: "미수금 건별 기록",
        action: "view",
      },
      {
        href: "/management/ledger",
        label: "경영지원 관리",
        action: "view",
      },
      {
        href: "/management/upload",
        label: "엑셀 업로드·데이터 이관",
        action: "view",
      },
      {
        href: "/management/targets",
        label: "목표·항목 설정",
        action: "confirm",
      },
      // 변경 이력 — 관리자(대표) + 경영지원팀 (경영지원 열람 = 이 두 역할). 관리자 화면 기록은 화면 안에서 관리자(대표)만
      {
        href: "/management/history",
        label: "변경 이력",
        action: "view",
      },
    ],
  },
  {
    href: "/production",
    label: "생산",
    team: "production",
    // 통합 2단계(2026-11-03): 생산팀 저장소 화면 — 메뉴 순서도 친구 저장소 config/menu.js 그대로
    children: [
      { href: "/production", label: "생산 대시보드", action: "view" },
      { href: "/production/records", label: "제조내역", action: "view" },
      { href: "/production/search", label: "일련번호 검색", action: "view" },
      { href: "/production/calendar", label: "납기 캘린더", action: "view" },
      // 팀원도 화면은 보고 버튼만 비활성 ("열람 전용")
      { href: "/production/upload", label: "엑셀 업로드", action: "view" },
      {
        href: "/production/categories",
        label: "사업구분 지정",
        action: "view",
      },
    ],
  },
  // 통합 3단계(2026-11-03): 서비스팀 저장소 화면 — 메뉴 묶음·순서도 친구 저장소 config/menu.js 그대로
  {
    href: "/service",
    label: "서비스",
    team: "service",
    children: [
      { href: "/service", label: "서비스 대시보드", action: "view" },
      { href: "/service/reports", label: "출장보고서", action: "view" },
    ],
  },
  {
    href: "/service/parts",
    label: "부품·가격",
    team: "service",
    children: [
      { href: "/service/parts", label: "부품 목록", action: "view" },
      { href: "/service/sites", label: "출장지 관리", action: "view" },
      {
        href: "/service/prices",
        label: "부품 가격 관리",
        action: "view",
        exact: true,
      },
      {
        href: "/service/prices/by-site",
        label: "출장지별 가격 조회",
        action: "view",
      },
      {
        href: "/service/prices/compare",
        label: "출장지 비교 분석",
        action: "view",
      },
    ],
  },
  // 2026-11-05: 친구 우민영 저장소 "단가" 메뉴 (담당자 피드백 — 단가 직접 입력·제품 단가·원가 탭 없음)
  {
    href: "/service/unit-prices",
    label: "단가",
    team: "service",
    children: [
      {
        href: "/service/unit-prices",
        label: "부품별 비교",
        action: "view",
        exact: true,
      },
      {
        href: "/service/unit-prices/companies",
        label: "출장지별 비교",
        action: "view",
      },
      {
        href: "/service/unit-prices/upload",
        label: "단가 데이터 업로드",
        action: "view",
      },
      { href: "/service/unit-prices/new", label: "부품 추가", action: "view" },
    ],
  },
  { href: "/admin", label: "관리자", adminOnly: true },
];

/** 관리자 설정 화면 — 판단은 can.ts 의 canManageUsers() */
export function canAccessAdmin(user: AppUser): boolean {
  return canManageUsers(user);
}

/** 사이드바·403 화면에 보여줄, 이 사용자가 열 수 있는 페이지 (하위 메뉴 포함) */
export function accessiblePages(user: AppUser): NavItem[] {
  return NAV_RULES.filter((rule) =>
    "adminOnly" in rule ? canAccessAdmin(user) : can(user, "view", rule.team),
  ).map((rule) => {
    const children =
      "team" in rule && rule.children
        ? rule.children
            .filter((c) => can(user, c.action, rule.team))
            .map(({ href, label, exact }) => ({
              href,
              label,
              ...(exact ? { exact } : {}),
            }))
        : undefined;
    return {
      href: rule.href,
      label: rule.label,
      ...(children ? { children } : {}),
    };
  });
}

/** 열 수 있는 페이지가 하나도 없을 때 (권한 없음 안내) */
export const NO_ACCESS_PATH = "/forbidden";

/**
 * 로그인 후·메인에 접근할 수 없을 때 이동할 페이지
 * 메인 → 열람 범위의 첫 팀(생산 → 서비스 순, 겸직이면 생산) → 없으면 권한 없음 안내
 */
export function homePathFor(user: AppUser): string {
  if (can(user, "view", "management")) return "/";
  const page = accessiblePages(user)[0];
  return page?.href ?? NO_ACCESS_PATH;
}
