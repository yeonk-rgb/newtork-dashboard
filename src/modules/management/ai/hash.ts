// AI 입력 해시: 키 순서와 무관하게 같은 값이면 같은 해시 (저장 후 데이터가 바뀌었는지 비교)
import { createHash } from "node:crypto";

/** 객체 키를 정렬한 JSON (배열 순서는 의미가 있으므로 유지) */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashAiInput(input: unknown): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}
