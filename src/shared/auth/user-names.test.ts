import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const findMany = vi.fn(async () => [{ id: "u1", name: "윤경영" }]);
vi.mock("@/shared/db/client", () => ({
  prisma: {
    authUser: { findMany: (...args: unknown[]) => findMany(...(args as [])) },
  },
}));

const { loadUserNames } = await import("./user-names");

describe("loadUserNames — 작성자 id → 이름", () => {
  it("사용자 테이블 이름, 시드·이전 개발 사용자·빈 값 처리", async () => {
    const nameOf = await loadUserNames([
      "u1",
      "seed",
      "dev-mgmt-leader",
      null,
      "u1",
    ]);
    expect(nameOf("u1")).toBe("윤경영");
    expect(nameOf("seed")).toBe("샘플 데이터");
    expect(nameOf("dev-mgmt-leader")).toBe("이전 개발 사용자");
    expect(nameOf("gone")).toBe("알 수 없는 사용자");
    expect(nameOf(null)).toBe("-");
    // 중복·빈 값은 빼고 한 번만 조회
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("조회할 id가 없으면 DB를 부르지 않는다", async () => {
    findMany.mockClear();
    await loadUserNames([null, undefined]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
