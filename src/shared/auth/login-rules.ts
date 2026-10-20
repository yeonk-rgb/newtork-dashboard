// 로그인·비밀번호 규칙 (순수 함수 — DB·쿠키 모름, 테스트용으로 분리)

/** 연속 실패 허용 횟수 — 이 횟수에 닿으면 잠근다 */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 10;
/** 로그인 유지 시간 (이후 다시 로그인) */
export const SESSION_HOURS = 12;

export const LOGIN_FAILED_MESSAGE = "아이디 또는 비밀번호가 올바르지 않습니다.";

export function isLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}

/** 잠금 안내 (남은 분은 올림) */
export function lockedMessage(lockedUntil: Date, now: Date): string {
  const minutes = Math.max(
    1,
    Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000),
  );
  return `로그인 ${MAX_FAILED_LOGINS}회 실패로 잠겼습니다. ${minutes}분 후 다시 시도하세요.`;
}

/**
 * 실패 1회 반영. 잠금 시간이 지났으면 횟수를 새로 센다.
 * 5회째 실패하면 10분 잠그고 횟수는 0으로 (잠금이 풀리면 다시 5회)
 */
export function afterFailedLogin(
  state: { failedLoginCount: number; lockedUntil: Date | null },
  now: Date,
): { failedLoginCount: number; lockedUntil: Date | null } {
  const expired =
    state.lockedUntil !== null && state.lockedUntil.getTime() <= now.getTime();
  const count = (expired ? 0 : state.failedLoginCount) + 1;
  if (count >= MAX_FAILED_LOGINS) {
    return {
      failedLoginCount: 0,
      lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000),
    };
  }
  return { failedLoginCount: count, lockedUntil: null };
}

export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_HOURS * 60 * 60_000);
}

/**
 * 로그인 후 돌아갈 주소 — 이 사이트 안의 경로만 허용 (외부 주소로 보내는 공격 방지)
 * 로그인·비밀번호 변경 화면 자신은 제외
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(next)) return null;
  const path = next.split(/[?#]/)[0];
  if (path === "/login" || path === "/account/password") return null;
  return next;
}

/** 새 비밀번호 규칙: 8자 이상, 영문+숫자, 아이디·현재 비밀번호와 다르게 */
export function newPasswordError(input: {
  password: string;
  loginId: string;
  currentPassword: string;
}): string | null {
  const { password, loginId, currentPassword } = input;
  if (password.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (password.length > 64) return "비밀번호는 64자 이하로 입력하세요.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "영문과 숫자를 모두 포함하세요.";
  }
  if (password.toLowerCase() === loginId.toLowerCase()) {
    return "아이디와 같은 비밀번호는 쓸 수 없습니다.";
  }
  if (password === currentPassword) {
    return "현재 비밀번호와 다른 비밀번호를 입력하세요.";
  }
  return null;
}
