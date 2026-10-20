// AI 분석 코멘트 규칙 (순수 함수): 어느 분기를 분석할지, 지금 분석할 수 있는지
// 화면(클라이언트)에서도 쓰므로 server-only 인 "@/shared/auth" 대신 순수 모듈을 직접 가져온다
import { can } from "@/shared/auth/can";
import type { AppUser } from "@/shared/auth/types";
import {
  periodEndDate,
  periodMonths,
  previousPeriod,
  quarterOf,
  samePeriodLastYear,
  type Period,
  type Quarter,
  type YearMonth,
} from "@/shared/period/period";

export type QuarterPeriod = Extract<Period, { unit: "quarter" }>;

/**
 * 카드가 보여줄 분기 (docs 8단계 합의 1번)
 * - 분기 보기: 그 분기 / 월 보기: 그 달이 속한 분기
 * - 연간·누적 보기: 선택 기간 안에서 확정 월이 있는 마지막 분기 (없으면 null)
 * @param confirmedMonths 선택 기간의 확정 월 (summary.confirmation.confirmedMonths)
 */
export function aiTargetQuarter(
  period: Period,
  confirmedMonths: YearMonth[],
): QuarterPeriod | null {
  switch (period.unit) {
    case "quarter":
      return period;
    case "month":
      return {
        unit: "quarter",
        year: period.year,
        quarter: quarterOf(period.month),
      };
    case "year":
    case "ytd": {
      const last = confirmedMonths
        .filter((m) => m.year === period.year)
        .reduce<number>((max, m) => Math.max(max, m.month), 0);
      if (last === 0) return null;
      return { unit: "quarter", year: period.year, quarter: quarterOf(last) };
    }
  }
}

export type AiAbilities = {
  /** [분석하기]/[다시 분석] 버튼 */
  canGenerate: boolean;
  /** 버튼이 없거나 막힌 이유 (없으면 null) */
  notice: string | null;
};

/**
 * 분석 가능 여부. 서버 Server Action 과 화면이 같은 함수를 쓴다.
 * - confirm 권한(팀장·관리자·대표)만
 * - 끝난 분기만 (진행 중인 분기는 미수금 기준일이 매일 바뀌어 결과가 금방 낡음 — 합의 2번)
 * - 그 분기에 확정 월이 하나 이상 있어야 함
 * @param today UTC 자정 (한국 날짜)
 */
export const UPLOADED_DATA_NOTICE =
  "외부 AI 전송 동의 확인 전에는 업로드 데이터를 분석할 수 없습니다.";

/**
 * 분석 가능 여부. 서버 Server Action 과 화면이 같은 함수를 쓴다.
 * - uploadedData: AI 입력에 엑셀 업로드 데이터가 들어감 → 외부 AI 전송 동의(05-19) 전까지 차단
 */
export function aiAbilities(
  user: AppUser,
  quarter: QuarterPeriod,
  today: Date,
  hasConfirmedData: boolean,
  uploadedData = false,
): AiAbilities {
  const end = periodEndDate(quarter);
  if (end.getTime() >= today.getTime()) {
    const next = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    return {
      canGenerate: false,
      notice: `분기가 끝난 뒤(${next.getUTCMonth() + 1}월 ${next.getUTCDate()}일부터) 분석할 수 있습니다.`,
    };
  }
  if (!hasConfirmedData) {
    return {
      canGenerate: false,
      notice: "이 분기에 확정된 달이 없어 분석할 수 없습니다.",
    };
  }
  if (uploadedData) return { canGenerate: false, notice: UPLOADED_DATA_NOTICE };
  if (!can(user, "confirm", "management")) {
    return { canGenerate: false, notice: null };
  }
  return { canGenerate: true, notice: null };
}

export function quarterKey(year: number, quarter: Quarter | number): string {
  return `${year}-Q${quarter}`;
}

/**
 * AI 분석 카드 노출 (메인 `/`·경영지원 상세 `/management` 공통)
 * - none: 카드 없음 (경영지원 열람 권한 없음 — 이 경우 페이지 자체가 이동·차단된다)
 * - view: 결과만 열람 / generate: [분석하기]·[다시 분석] 가능 (분기 조건은 aiAbilities 가 추가로 판단)
 */
export function aiCardAccess(user: AppUser): "none" | "view" | "generate" {
  if (!can(user, "view", "management")) return "none";
  return can(user, "confirm", "management") ? "generate" : "view";
}

/**
 * 이 분기 AI 입력(buildAiInput)에 쓰이는 달: 그 분기, 직전 분기, 전년 동기, 그 해 1월~분기 말(목표 누적)
 * — 이 중 엑셀 업로드 데이터가 있으면 분석을 막는다
 */
export function aiInputMonths(quarter: QuarterPeriod): YearMonth[] {
  const yearToDate = Array.from({ length: quarter.quarter * 3 }, (_, i) => ({
    year: quarter.year,
    month: i + 1,
  }));
  const all = [
    ...periodMonths(quarter),
    ...periodMonths(previousPeriod(quarter)),
    ...periodMonths(samePeriodLastYear(quarter)),
    ...yearToDate,
  ];
  const seen = new Set<string>();
  return all.filter((m) => {
    const key = `${m.year}-${m.month}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
