// 변경 기록 금지 칸 검사 (순수 함수) — 비밀번호·해시·토큰·세션 같은 값이 기록에 들어가지 않게 하는 두 번째 안전장치
// 첫 번째는 화면마다 "기록할 칸" 목록(허용 목록)에 있는 칸만 비교하는 것 (diff.ts)

/** 칸 이름에 이 글자가 들어가면 기록하지 않는다 (대소문자 무시) */
const FORBIDDEN =
  /pass(word|wd)?|hash|token|secret|session|salt|credential|apikey|api_key/i;

export function isForbiddenKey(key: string): boolean {
  return FORBIDDEN.test(key);
}

/** 금지 칸 이름 목록 (중첩된 meta 까지) — 비어 있으면 통과 */
export function findForbiddenKeys(
  value: unknown,
  path = "",
  found: string[] = [],
): string[] {
  if (Array.isArray(value)) {
    value.forEach((v, i) => findForbiddenKeys(v, `${path}[${i}]`, found));
  } else if (value && typeof value === "object" && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) {
      const here = path ? `${path}.${k}` : k;
      if (isForbiddenKey(k)) found.push(here);
      findForbiddenKeys(v, here, found);
    }
  }
  return found;
}
