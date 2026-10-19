import { describe, expect, it } from "vitest";

import { achievementText, progressText } from "./phrases";

describe("achievementText", () => {
  it("미달: 부족 %p", () => {
    expect(achievementText(0.824)).toBe("82.4%로 17.6%p 부족");
    expect(achievementText(0)).toBe("0.0%로 100.0%p 부족");
  });

  it("초과: 초과 %p", () => {
    expect(achievementText(1.052)).toBe("105.2%로 5.2%p 초과");
    expect(achievementText(2)).toBe("200.0%로 100.0%p 초과");
  });

  it("정확히 100%", () => {
    expect(achievementText(1)).toBe("100.0%로 목표 달성");
  });

  it("표시값끼리 계산해 숫자가 서로 맞는다 (반올림 경계)", () => {
    // 0.82349 → 82.3%, 차이 17.7%p (82.3 + 17.7 = 100)
    expect(achievementText(0.82349)).toBe("82.3%로 17.7%p 부족");
    expect(achievementText(0.82351)).toBe("82.4%로 17.6%p 부족");
    // 부동소수 오차로 99.9999…% 가 되어도 100% 로
    expect(achievementText(0.1 + 0.2 + 0.7)).toBe("100.0%로 목표 달성");
  });
});

describe("progressText", () => {
  it("뒤처짐 / 앞섬 / 같음", () => {
    expect(progressText(0.6, 0.75)).toBe(
      "연간 달성률 60.0%로 경과율 75.0% 대비 15.0%p 뒤처짐",
    );
    expect(progressText(0.802, 0.75)).toBe(
      "연간 달성률 80.2%로 경과율 75.0% 대비 5.2%p 앞섬",
    );
    expect(progressText(0.5, 0.5)).toBe(
      "연간 달성률 50.0%로 경과율 50.0%와 같음",
    );
  });
});
