import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json 의 "@/*" 경로 별칭을 테스트에서도 사용 (Vite 8 기본 기능)
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // 기본 5초 → 30초 (2026-10-26): 엑셀(exceljs) 파일을 만들고 읽는 테스트와 scrypt 해시 테스트가
    // 다른 테스트와 동시에 돌 때 5초를 넘겨 가끔 실패했다 (기능 문제 아님 — 부하 3배에서 재현, 혼자 돌리면 통과)
    testTimeout: 30_000,
  },
});
