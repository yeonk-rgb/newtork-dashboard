import { describe, expect, it } from "vitest";

import { pct, pct1 } from "./labels";

describe("pct1 — 친구 앱 파이썬 round(x, 1) 과 같은 반올림", () => {
  it("딱 절반이면 짝수 쪽", () => {
    expect(pct1(9 / 16)).toBe(56.2); // 56.25
    expect(pct1(4 / 64)).toBe(6.2); // 6.25
    expect(pct1(0.0875)).toBe(8.8); // 8.75
  });
  it("그 밖에는 보통 반올림", () => {
    expect(pct1(2 / 3)).toBe(66.7);
    expect(pct1(0.5)).toBe(50);
    expect(pct(null)).toBe("-");
    expect(pct(1)).toBe("100%");
  });
});
