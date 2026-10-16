// Prisma 7: DB 접속 URL과 스키마 위치는 이 파일에서 지정한다 (schema.prisma에는 url 없음).
// .env는 자동으로 읽히지 않으므로 dotenv로 직접 로드한다.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // 폴더를 지정하면 하위의 *.prisma 파일을 모두 합쳐서 하나의 스키마로 읽는다.
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
