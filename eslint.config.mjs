import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 팀 모듈 경계 — CLAUDE.md "운영 규칙" 참고
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "app", pattern: "src/app" },
        { type: "module", pattern: "src/modules/*", capture: ["team"] },
        { type: "shared", pattern: "src/shared/*", capture: ["area"] },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        2,
        {
          default: "allow",
          policies: [
            // 1) 팀 모듈끼리 직접 import 금지 (같은 모듈 내부는 허용)
            {
              from: { element: { type: "module" } },
              disallow: {
                to: {
                  element: {
                    type: "module",
                    captured: { team: "!{{ from.element.captured.team }}" },
                  },
                },
              },
            },
            // 2) app 에서 팀 모듈은 공개 API(index.ts)로만 import
            {
              from: { element: { type: "app" } },
              disallow: {
                to: {
                  element: { type: "module", fileInternalPath: "!index.ts" },
                },
              },
            },
            // 3) shared 는 팀 모듈에 의존하지 않는다
            {
              from: { element: { type: "shared" } },
              disallow: { to: { element: { type: "module" } } },
            },
          ],
        },
      ],
    },
  },
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/shared/db/generated/**",
  ]),
]);

export default eslintConfig;
