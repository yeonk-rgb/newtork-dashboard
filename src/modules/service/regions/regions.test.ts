// 친구 저장소 backend/service/tests/test_regions.py 사례 그대로
import { describe, expect, it } from "vitest";

import {
  SIDO,
  SIGUNGU,
  isValidRegion,
  parseAddress,
  regionLabel,
} from "./regions";

const r = (region: string | null, sigungu: string | null) => ({
  region,
  sigungu,
});

describe("parseAddress", () => {
  it.each([
    ["경남 창원시 의창구 중앙대로", r("경상남도", "창원시")],
    ["경상남도 창원시의창구", r("경상남도", "창원시")],
    ["부산광역시 해운대구 우동", r("부산광역시", "해운대구")],
    ["부산 해운대구", r("부산광역시", "해운대구")],
    ["충청북도 청주시 청원구 오창읍", r("충청북도", "청주시")],
    ["서울 강남구 테헤란로", r("서울특별시", "강남구")],
    ["  경기   성남시 분당구", r("경기도", "성남시")],
    ["경기 광주시 오포읍", r("경기도", "광주시")],
    ["대구 군위군 군위읍", r("대구광역시", "군위군")],
    ["제주 서귀포시 중앙로", r("제주특별자치도", "서귀포시")],
    ["세종 한누리대로", r("세종특별자치시", "세종시")],
    ["인천 영종구 공항로", r("인천광역시", "영종구")],
    ["강원도 춘천시", r("강원특별자치도", "춘천시")],
    ["전라북도 전주시 완산구", r("전북특별자치도", "전주시")],
  ])("%s", (address, expected) => {
    expect(parseAddress(address)).toEqual(expected);
  });

  it("공식 편입·통합만 연결", () => {
    expect(parseAddress("경북 군위군 군위읍")).toEqual(
      r("대구광역시", "군위군"),
    );
    expect(parseAddress("광주광역시 북구 용봉로")).toEqual(
      r("전남광주통합특별시", "북구"),
    );
    expect(parseAddress("전남 순천시")).toEqual(
      r("전남광주통합특별시", "순천시"),
    );
  });

  it("모르는 부분은 추정하지 않음", () => {
    expect(parseAddress("충북 오창읍")).toEqual(r("충청북도", null));
    expect(parseAddress("인천 중구 영종대로")).toEqual(r("인천광역시", null));
    expect(parseAddress("충북")).toEqual(r("충청북도", null));
    for (const a of [
      "오창과학산업단지",
      "광주 북구",
      "청주시 오창읍",
      "",
      "   ",
      null,
    ]) {
      expect(parseAddress(a)).toEqual(r(null, null));
    }
  });
});

describe("공식 목록", () => {
  it("2026-10-01 기준 개수", () => {
    expect(SIDO).toHaveLength(16);
    expect(SIDO).not.toContain("광주광역시");
    expect(
      Object.values(SIGUNGU).reduce((n, v) => n + Object.keys(v).length, 0),
    ).toBe(230);
    expect(Object.keys(SIGUNGU["경기도"])).toHaveLength(31);
    expect(SIGUNGU["인천광역시"]).toHaveProperty("제물포구");
    expect(SIGUNGU["경상남도"]).not.toHaveProperty("창원시의창구");
  });

  it("검증과 표시 이름", () => {
    expect(isValidRegion("경상남도", "창원시")).toBe(true);
    expect(isValidRegion("경상남도", null)).toBe(true);
    expect(isValidRegion(null, null)).toBe(true);
    expect(isValidRegion("경상남도", "해운대구")).toBe(false);
    expect(isValidRegion(null, "창원시")).toBe(false);
    expect(regionLabel("경상남도", "창원시")).toBe("경상남도 창원시");
    expect(regionLabel("세종특별자치시", "세종시")).toBe("세종특별자치시");
    expect(regionLabel("충청북도", null)).toBe("충청북도(시·군·구 미확인)");
    expect(regionLabel(null, null)).toBe("미지정");
  });
});
