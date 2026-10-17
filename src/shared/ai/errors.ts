// AI 호출 오류 종류 + 화면 안내 문구 (순수 모듈 — 화면에서도 import 가능)

export type AiErrorKind =
  | "not-configured" // API 키 없음
  | "auth" // 키가 틀렸거나 권한 없음 (401·403)
  | "rate-limit" // 사용량 초과 (429)
  | "overloaded" // AI 서버 오류·혼잡 (5xx·529)
  | "timeout"
  | "connection"
  | "bad-request" // 요청 형식 오류 (400) — 코드 수정 필요
  | "refusal" // AI가 응답을 거절
  | "truncated" // 응답이 길이 제한에 걸려 잘림
  | "invalid-output" // 응답 JSON 이 형식에 맞지 않음
  | "unknown";

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message?: string,
  ) {
    super(message ?? kind);
    this.name = "AiError";
  }
}

/** 사용자에게 보여줄 안내 (원인 + 할 일) */
export function aiErrorMessage(kind: AiErrorKind): string {
  switch (kind) {
    case "not-configured":
      return "AI API 키가 설정되지 않았습니다. 관리자에게 키 설정(npm run env:set-key)을 요청하세요.";
    case "auth":
      return "AI API 키가 올바르지 않거나 권한이 없습니다. 관리자에게 키 확인을 요청하세요.";
    case "rate-limit":
      return "AI 사용량 한도에 걸렸습니다. 잠시 후 다시 시도하세요.";
    case "overloaded":
      return "AI 서버가 혼잡하거나 일시적인 오류가 있습니다. 잠시 후 다시 시도하세요.";
    case "timeout":
      return "AI 응답 시간이 초과되었습니다. 다시 시도하세요.";
    case "connection":
      return "AI 서버에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도하세요.";
    case "bad-request":
      return "AI 요청 형식에 문제가 있습니다. 개발 담당자에게 알려 주세요.";
    case "refusal":
      return "AI가 이번 요청에 응답하지 않았습니다. 다시 시도하세요.";
    case "truncated":
      return "AI 응답이 중간에 잘렸습니다. 다시 시도하세요.";
    case "invalid-output":
      return "AI 응답 형식이 올바르지 않습니다. 다시 시도하세요.";
    case "unknown":
      return "AI 분석 중 알 수 없는 오류가 발생했습니다. 다시 시도하세요.";
  }
}

/** 다시 시도해 볼 만한 오류인지 (키·요청 형식 문제는 다시 눌러도 같음) */
export function isRetryable(kind: AiErrorKind): boolean {
  return !["not-configured", "auth", "bad-request"].includes(kind);
}
