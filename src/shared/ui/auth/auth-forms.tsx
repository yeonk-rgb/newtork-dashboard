"use client";
// 로그인·비밀번호 변경 폼 (Server Action + useActionState)
import { useActionState } from "react";

import {
  changePassword,
  login,
  type AuthFormState,
} from "@/shared/auth/actions";

const INITIAL: AuthFormState = { error: null };

const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:border-destructive";

function Field({
  label,
  name,
  type = "password",
  autoComplete,
  invalid,
  autoFocus,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
  invalid: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        className={fieldClass}
      />
    </label>
  );
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  );
}

export function LoginForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState(login, INITIAL);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field
        label="아이디"
        name="loginId"
        type="text"
        autoComplete="username"
        invalid={!!state.error}
        autoFocus
      />
      <Field
        label="비밀번호"
        name="password"
        autoComplete="current-password"
        invalid={!!state.error}
      />
      <ErrorText error={state.error} />
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}

export function ChangePasswordForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState(changePassword, INITIAL);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field
        label="현재 비밀번호 (초기 비밀번호)"
        name="currentPassword"
        autoComplete="current-password"
        invalid={false}
        autoFocus
      />
      <Field
        label="새 비밀번호"
        name="newPassword"
        autoComplete="new-password"
        invalid={!!state.error}
      />
      <Field
        label="새 비밀번호 확인"
        name="confirmPassword"
        autoComplete="new-password"
        invalid={!!state.error}
      />
      <p className="text-xs text-muted-foreground">
        8자 이상, 영문과 숫자를 모두 포함하고, 아이디·현재 비밀번호와 다르게
        정하세요.
      </p>
      <ErrorText error={state.error} />
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "변경 중…" : "비밀번호 변경"}
      </button>
    </form>
  );
}
