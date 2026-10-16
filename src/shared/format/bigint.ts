// BigInt는 JSON.stringify와 서버→클라이언트 전달이 안 되므로 정수 문자열로 바꿔서 넘긴다.
// (number로 바꾸면 2^53 이상에서 값이 틀어질 수 있다)

/** 타입 안의 bigint를 string으로 바꾼 타입 */
export type BigIntToString<T> = T extends bigint
  ? string
  : T extends Date
    ? T
    : T extends readonly (infer U)[]
      ? BigIntToString<U>[]
      : T extends object
        ? { [K in keyof T]: BigIntToString<T[K]> }
        : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** 객체·배열을 재귀적으로 돌며 bigint만 문자열로 바꾼다. Date 등 그 외 값은 그대로 둔다. */
export function serializeBigInt<T>(value: T): BigIntToString<T> {
  if (typeof value === "bigint") {
    return value.toString() as BigIntToString<T>;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeBigInt(item)) as BigIntToString<T>;
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = serializeBigInt(item);
    }
    return result as BigIntToString<T>;
  }
  return value as BigIntToString<T>;
}

const INTEGER_STRING = /^-?\d+$/;

/** serializeBigInt로 만든 정수 문자열을 다시 bigint로 되돌린다. */
export function parseBigInt(value: string): bigint {
  if (!INTEGER_STRING.test(value)) {
    throw new TypeError(`정수 문자열이 아닙니다: "${value}"`);
  }
  return BigInt(value);
}
