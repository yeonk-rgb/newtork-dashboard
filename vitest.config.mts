import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json 의 "@/*" 경로 별칭을 테스트에서도 사용 (Vite 8 기본 기능)
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
