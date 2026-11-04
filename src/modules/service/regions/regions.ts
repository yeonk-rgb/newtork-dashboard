// 출장지 주소 → 시·도 / 시·군·구 판정 (순수 함수) — 친구 저장소 backend/service/regions.py 그대로
// 기준 목록 sigungu.json: 통계청 SGIS 행정동 경계(공공누리 제1유형)를 vuski/admdongkor 가 가공한 ver20261001(CC BY 4.0)
//  - 2026-10-01 기준 시·도 16개(광주광역시 + 전라남도 → 전남광주통합특별시, 2026-07-01), 인천 제물포·영종·서해·검단구 신설, 대구 군위군
// 단위: 특별시·광역시·통합특별시 = 자치구·군, 도 = 시·군(일반구는 시로 합침), 세종 = 세종시 1개
// 주소 첫 단어로 시·도, 둘째 단어로 시·군·구 — 공식 이름과 정확히 맞을 때만 정하고, 아니면 null (추정하지 않음)
import data from "./sigungu.json";

export const SOURCE: string = data.source;
export const BASE_DATE: string = data.base_date;

/** 화면·집계 표시 순서 */
export const SIDO = [
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전남광주통합특별시",
  "경상북도",
  "경상남도",
  "제주특별자치도",
] as const;

export const SHORT: Record<string, string> = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전북특별자치도: "전북",
  전남광주통합특별시: "전남광주",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};

/** 시·도별 시·군·구 {이름: [위도, 경도]} */
export const SIGUNGU: Record<string, Record<string, [number, number]>> = {};
for (const row of data.sigungu) {
  (SIGUNGU[row.sido] ??= {})[row.name] = [row.lat, row.lon];
}
/** 시·도 대표점 [위도, 경도] */
export const SIDO_POINT: Record<string, [number, number]> = Object.fromEntries(
  data.sido.map((r) => [r.name, [r.lat, r.lon]]),
);

const ALIASES: Record<string, string[]> = {
  서울특별시: ["서울", "서울시", "서울특별시"],
  부산광역시: ["부산", "부산시", "부산광역시"],
  대구광역시: ["대구", "대구시", "대구광역시"],
  인천광역시: ["인천", "인천시", "인천광역시"],
  대전광역시: ["대전", "대전시", "대전광역시"],
  울산광역시: ["울산", "울산시", "울산광역시"],
  세종특별자치시: ["세종", "세종시", "세종특별자치시"],
  경기도: ["경기", "경기도"],
  강원특별자치도: ["강원", "강원도", "강원특별자치도"],
  충청북도: ["충북", "충청북도"],
  충청남도: ["충남", "충청남도"],
  전북특별자치도: ["전북", "전라북도", "전북특별자치도"],
  // 2026-07-01 통합. '광주'·'광주시'는 경기도 광주시와 헷갈려 인정하지 않는다
  전남광주통합특별시: [
    "전남광주",
    "전남광주통합특별시",
    "광주광역시",
    "전남",
    "전라남도",
  ],
  경상북도: ["경북", "경상북도"],
  경상남도: ["경남", "경상남도"],
  제주특별자치도: ["제주", "제주도", "제주특별자치도"],
};
const LOOKUP = new Map(
  Object.entries(ALIASES).flatMap(([sido, names]) =>
    names.map((n) => [n, sido] as const),
  ),
);
/** 시·도가 바뀐 시·군·구 (공식 편입만) */
const MOVED: Record<string, [string, string]> = {
  "경상북도|군위군": ["대구광역시", "군위군"],
};
const GENERAL_GU = /^(\S+?시)\S+구$/; // 창원시의창구 → 창원시

export type Region = { region: string | null; sigungu: string | null };

export function parseAddress(address: string | null | undefined): Region {
  const words = (address ?? "").split(/\s+/).filter(Boolean);
  const sido = words[0] ? LOOKUP.get(words[0]) : undefined;
  if (!sido) return { region: null, sigungu: null };
  if (sido === "세종특별자치시") return { region: sido, sigungu: "세종시" };
  if (words.length < 2) return { region: sido, sigungu: null };
  let name = words[1];
  const m = GENERAL_GU.exec(name);
  if (m) name = m[1];
  const moved = MOVED[`${sido}|${name}`];
  if (moved) return { region: moved[0], sigungu: moved[1] };
  return { region: sido, sigungu: name in SIGUNGU[sido] ? name : null };
}

/** 저장 가능한 조합인지 (시·군·구는 그 시·도의 공식 목록에 있어야 함) */
export function isValidRegion(sido: string | null, sigungu: string | null) {
  if (sido === null) return sigungu === null;
  return sido in SIGUNGU && (sigungu === null || sigungu in SIGUNGU[sido]);
}

/** 화면 표시: '경상남도 창원시', '부산광역시 해운대구', 세종 '세종특별자치시' */
export function regionLabel(sido: string | null, sigungu: string | null) {
  if (!sido) return "미지정";
  if (!sigungu) return `${sido}(시·군·구 미확인)`;
  return sido === "세종특별자치시" ? sido : `${sido} ${sigungu}`;
}

/** 선택 상자용: 시·도 순서대로 시·군·구 이름 목록 (가나다순) */
export function regionChoices() {
  return SIDO.map((s) => ({
    name: s,
    short: SHORT[s],
    sigungu: Object.keys(SIGUNGU[s]).sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    ),
  }));
}
