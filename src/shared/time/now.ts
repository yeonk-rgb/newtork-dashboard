// 현재 시각 (기록용) — 요청 시점 값이 빌드 결과에 굳지 않도록 connection() 뒤에서 구한다.
// new Date()를 직접 쓰지 말고 이 함수를 쓴다 (cacheComponents prerender 에러 방지).
import { connection } from "next/server";

export async function getNow(): Promise<Date> {
  await connection();
  return new Date();
}
